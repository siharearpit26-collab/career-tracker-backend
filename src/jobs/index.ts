import { logger } from '../utils/logger';
import { config } from '../config';

let workersStarted = false;

export const startBackgroundWorkers = async (): Promise<void> => {
  if (workersStarted) return;
  workersStarted = true;

  const redisAvailable = config.redis.host && config.redis.host !== 'localhost';

  if (redisAvailable) {
    // Use BullMQ for proper job queue with Redis
    try {
      const { createEmailSyncWorker, scheduleRecurringSync } = await import('./emailSync.job');
      const { createReminderWorker, scheduleReminderChecks } = await import('./reminder.job');
      const { createWeeklyDigestWorker, scheduleWeeklyDigest } = await import('./weeklyDigest.job');

      createEmailSyncWorker();
      createReminderWorker();
      createWeeklyDigestWorker();

      await scheduleRecurringSync();
      await scheduleReminderChecks();
      await scheduleWeeklyDigest();

      logger.info('Background workers started with Redis/BullMQ');
    } catch (error) {
      logger.warn('BullMQ workers failed to start, falling back to interval-based sync:', error);
      startIntervalSync();
    }
  } else {
    // No Redis — use simple setInterval fallback (works on Render free tier without Redis)
    logger.info('Redis not configured — using interval-based background sync (every 30 min)');
    startIntervalSync();
  }
};

// Simple interval-based sync that works without Redis
function startIntervalSync(): void {
  // Run once after 2 minutes on startup (let server warm up first)
  setTimeout(() => {
    void runScheduledSync();
  }, 2 * 60 * 1000);

  // Then every 30 minutes
  setInterval(() => {
    void runScheduledSync();
  }, 30 * 60 * 1000);
}

async function runScheduledSync(): Promise<void> {
  try {
    const { emailRepository } = await import('../repositories/email.repository');
    const { emailSyncService } = await import('../services/emailSync.service');

    const accounts = await emailRepository.findAllActiveAccounts();
    if (accounts.length === 0) return;

    logger.info(`Interval sync: syncing ${accounts.length} account(s)`);

    for (const account of accounts) {
      try {
        const result = await emailSyncService.syncAccount(account);
        logger.info(`Interval sync complete for ${account.email}: ${result.newEmails} new, ${result.matched} matched`);
      } catch (error) {
        logger.error(`Interval sync failed for ${account.email}:`, error);
      }
    }
  } catch (error) {
    logger.error('Interval sync error:', error);
  }
}

// No-op queue functions when Redis is unavailable
export const queueAccountSync = async (
  _accountId: string,
  _userId: string
): Promise<void> => {
  if (!config.redis.host || config.redis.host === 'localhost') return;
  try {
    const { queueAccountSync: realQueue } = await import('./emailSync.job');
    await realQueue(_accountId, _userId);
  } catch {
    // Silently fail
  }
};

export const queueFullSync = async (): Promise<void> => {
  if (!config.redis.host || config.redis.host === 'localhost') return;
  try {
    const { queueFullSync: realQueue } = await import('./emailSync.job');
    await realQueue();
  } catch {
    // Silently fail
  }
};
