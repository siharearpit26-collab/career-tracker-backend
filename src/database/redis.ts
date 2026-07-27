import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export const createRedisClient = (): Redis => {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.warn('Redis not available after 3 retries — caching disabled');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 1000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('connect', () => {
    isRedisAvailable = true;
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    isRedisAvailable = true;
  });

  client.on('error', (error: Error) => {
    isRedisAvailable = false;
    logger.warn('Redis client error (caching disabled):', error.message);
  });

  client.on('close', () => {
    isRedisAvailable = false;
    logger.warn('Redis client connection closed');
  });

  return client;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = createRedisClient();
    void redisClient.connect().catch(() => {
      logger.warn('Redis initial connection failed — caching disabled');
    });
  }
  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisAvailable = false;
    logger.info('Redis connection closed');
  }
};

// Cache utilities — silently no-op if Redis is unavailable
export const setCache = async (
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> => {
  if (!isRedisAvailable) return;
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch {
    // Silently fail — cache is optional
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisAvailable) return null;
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  if (!isRedisAvailable) return;
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch {
    // Silently fail
  }
};

export const deleteCachePattern = async (pattern: string): Promise<void> => {
  if (!isRedisAvailable) return;
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Silently fail
  }
};
