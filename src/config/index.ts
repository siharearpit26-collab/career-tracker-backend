import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
};

export const config = {
  app: {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 5000),
    clientUrl: getEnv('CLIENT_URL', 'http://localhost:3000'),
    isProduction: process.env['NODE_ENV'] === 'production',
    isDevelopment: process.env['NODE_ENV'] === 'development',
    isTest: process.env['NODE_ENV'] === 'test',
  },
  database: {
    mongoUri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/careertracker'),
    mongoTestUri: getEnv(
      'MONGODB_TEST_URI',
      'mongodb://localhost:27017/careertracker_test'
    ),
  },
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env['REDIS_PASSWORD'],
  },
  jwt: {
    secret: getEnv('JWT_SECRET', 'fallback-secret-change-in-production'),
    refreshSecret: getEnv(
      'JWT_REFRESH_SECRET',
      'fallback-refresh-secret-change-in-production'
    ),
    accessExpiration: getEnv('JWT_ACCESS_EXPIRATION', '15m'),
    refreshExpiration: getEnv('JWT_REFRESH_EXPIRATION', '7d'),
  },
  email: {
    host: getEnv('SMTP_HOST', 'smtp.gmail.com'),
    port: getEnvNumber('SMTP_PORT', 587),
    user: getEnv('SMTP_USER', ''),
    password: getEnv('SMTP_PASSWORD', ''),
    from: getEnv('EMAIL_FROM', 'noreply@careertracker.com'),
  },
  google: {
    clientId: getEnv('GOOGLE_CLIENT_ID', ''),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: getEnv(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:5000/api/auth/google/callback'
    ),
  },
  upload: {
    maxFileSize: getEnvNumber('MAX_FILE_SIZE', 5242880),
    allowedFileTypes: getEnv(
      'ALLOWED_FILE_TYPES',
      'image/jpeg,image/png,image/jpg,application/pdf'
    ).split(','),
  },
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },
  pagination: {
    defaultPageSize: getEnvNumber('DEFAULT_PAGE_SIZE', 10),
    maxPageSize: getEnvNumber('MAX_PAGE_SIZE', 100),
  },
  session: {
    secret: getEnv('SESSION_SECRET', 'fallback-session-secret'),
  },
  openai: {
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
  },
} as const;

export type Config = typeof config;
