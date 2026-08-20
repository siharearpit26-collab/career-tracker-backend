import { logger } from '../utils/logger';
import { config } from '../config';

let workersStarted = false;

export const startBackgroundWorkers = async (): Promise<void> => {
  if (workersStarted) return;
  workersStarted = true;

  // Skip workers entirely if Redis is not configured or host is localhost on production
  if (!config.redis.host || (config.app.isProduction && config.redis.host === 'localhost')) {
    logger.info('Background workers disabled (no Redis configured)');
    return;
  }

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

    logger.info('Background workers started successfully');
  } catch (error) {
    logger.warn('Background workers failed to start (Redis may be unavailable):', error);
  }
};

// No-op queue functions when Redis is unavailable
export const queueAccountSync = async (
  _accountId: string,
  _userId: string
): Promise<void> => {
  if (config.app.isProduction && config.redis.host === 'localhost') return;
  try {
    const { queueAccountSync: realQueue } = await import('./emailSync.job');
    await realQueue(_accountId, _userId);
  } catch {
    // Silently fail
  }
};

export const queueFullSync = async (): Promise<void> => {
  if (config.app.isProduction && config.redis.host === 'localhost') return;
  try {
    const { queueFullSync: realQueue } = await import('./emailSync.job');
    await realQueue();
  } catch {
    // Silently fail
  }
};
