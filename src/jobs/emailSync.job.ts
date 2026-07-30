import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { emailRepository } from '../repositories/email.repository';
import { emailSyncService } from '../services/emailSync.service';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'email-sync';

// Redis connection options for BullMQ
const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
};

// Create the queue
export const emailSyncQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Job data interfaces
interface SyncAllJobData {
  type: 'sync-all';
}

interface SyncAccountJobData {
  type: 'sync-account';
  accountId: string;
  userId: string;
}

interface ScheduledSyncJobData {
  type: 'scheduled-sync';
}

type EmailSyncJobData = SyncAllJobData | SyncAccountJobData | ScheduledSyncJobData;

// Worker that processes sync jobs
export const createEmailSyncWorker = (): Worker<EmailSyncJobData> => {
  const worker = new Worker<EmailSyncJobData>(
    QUEUE_NAME,
    async (job: Job<EmailSyncJobData>) => {
      logger.info(`Processing email sync job: ${job.id} (${job.data.type})`);

      switch (job.data.type) {
        case 'sync-account': {
          const account = await emailRepository.findAccountById(job.data.accountId);
          if (account && account.isActive) {
            const result = await emailSyncService.syncAccount(account);
            logger.info(
              `Account sync complete (${account.email}): ${result.newEmails} new, ${result.matched} matched`
            );
            return result;
          }
          return undefined;
        }

        case 'sync-all':
        case 'scheduled-sync': {
          // Get all active accounts
          const accounts = await emailRepository.findAllActiveAccounts();
          let totalNew = 0;
          let totalMatched = 0;
          let totalUpdates = 0;

          for (const account of accounts) {
            try {
              const result = await emailSyncService.syncAccount(account);
              totalNew += result.newEmails;
              totalMatched += result.matched;
              totalUpdates += result.statusUpdates;
            } catch (error) {
              logger.error(`Failed to sync account ${account.email}:`, error);
            }
          }

          logger.info(
            `Scheduled sync complete: ${accounts.length} accounts, ${totalNew} new emails, ${totalMatched} matched, ${totalUpdates} updates`
          );

          return { totalNew, totalMatched, totalUpdates, accountsProcessed: accounts.length };
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Email sync job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Email sync job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    logger.error('Email sync worker error:', error);
  });

  return worker;
};

// Schedule recurring sync (every 30 minutes)
export const scheduleRecurringSync = async (): Promise<void> => {
  try {
    // Remove existing repeatable jobs
    const repeatableJobs = await emailSyncQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await emailSyncQueue.removeRepeatableByKey(job.key);
    }

    // Add new repeatable job
    await emailSyncQueue.add(
      'scheduled-sync',
      { type: 'scheduled-sync' } as ScheduledSyncJobData,
      {
        repeat: {
          every: 30 * 60 * 1000, // Every 30 minutes
        },
      }
    );

    logger.info('Scheduled recurring email sync every 30 minutes');
  } catch (error) {
    logger.error('Failed to schedule recurring email sync:', error);
  }
};

// Queue helper to add a sync job
export const queueAccountSync = async (
  accountId: string,
  userId: string
): Promise<void> => {
  await emailSyncQueue.add('sync-account', {
    type: 'sync-account',
    accountId,
    userId,
  } as SyncAccountJobData);
};

export const queueFullSync = async (): Promise<void> => {
  await emailSyncQueue.add('sync-all', {
    type: 'sync-all',
  } as SyncAllJobData);
};
