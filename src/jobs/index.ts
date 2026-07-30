import { createEmailSyncWorker, scheduleRecurringSync } from './emailSync.job';
import { createReminderWorker, scheduleReminderChecks } from './reminder.job';
import { logger } from '../utils/logger';

let workersStarted = false;

export const startBackgroundWorkers = async (): Promise<void> => {
  if (workersStarted) return;

  try {
    // Start workers
    createEmailSyncWorker();
    createReminderWorker();

    // Schedule recurring jobs
    await scheduleRecurringSync();
    await scheduleReminderChecks();

    workersStarted = true;
    logger.info('Background workers started successfully');
  } catch (error) {
    logger.warn('Background workers failed to start (Redis may be unavailable):', error);
    // Non-critical — app still works without background jobs
  }
};

export { queueAccountSync, queueFullSync } from './emailSync.job';
