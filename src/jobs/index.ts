import { logger } from '../utils/logger';
import { config } from '../config';

let workersStarted = false;

export const startBackgroundWorkers = async (): Promise<void> => {
  if (workersStarted) return;

  // Skip workers entirely if Redis is not configured or host is localhost on production
  if (!config.redis.host || (config.app.isProduction && config.redis.host === 'localhost')) {
    logger.info('Background workers disabled (no Redis configured)');
    workersStarted = true;
    return;
  }

  try {
    const { createEmailSyncWorker, scheduleRecurringSync } = await import('./emailSync.job');
    const { createReminderWorker, scheduleReminderChecks } = await import('./reminder.job');

    // Start workers
    createEmailSyncWorker();
    createReminderWorker();

    // Schedule recurring jobs
    await scheduleRecurringSync();
    await scheduleReminderChecks();

    workersStarted = true;
    logger.info('Background workers started successfully');
  } catch (error) {
    workersStarted = true; // Mark as started to prevent retries
    logger.warn('Background workers failed to start (Redis may be unavailable):', error);
  }
};

export { queueAccountSync, queueFullSync } from './emailSync.job';
