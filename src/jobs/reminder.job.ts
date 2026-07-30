import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { reminderRepository } from '../repositories/reminder.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { sendReminderEmail } from '../utils/email.utils';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'reminders';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
};

export const reminderQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
});

interface CheckRemindersJobData {
  type: 'check-due-reminders';
}

export const createReminderWorker = (): Worker<CheckRemindersJobData> => {
  const worker = new Worker<CheckRemindersJobData>(
    QUEUE_NAME,
    async (_job: Job<CheckRemindersJobData>) => {
      logger.info('Checking for due reminders...');

      const dueReminders = await reminderRepository.findDueReminders();

      if (dueReminders.length === 0) {
        logger.info('No due reminders found');
        return { processed: 0 };
      }

      let processed = 0;

      for (const reminder of dueReminders) {
        try {
          // Create notification
          await notificationRepository.create({
            userId: reminder.userId.toString(),
            title: `Reminder: ${reminder.title}`,
            message: reminder.description ?? `Your reminder "${reminder.title}" is due now.`,
            type: 'interview_reminder',
            reminderId: reminder._id.toString(),
            applicationId: reminder.applicationId?.toString(),
          });

          // Try to send email (non-critical)
          try {
            const user = reminder.userId as unknown as {
              email: string;
              firstName: string;
              preferences?: { reminderNotifications?: boolean };
            };

            if (user.preferences?.reminderNotifications !== false) {
              await sendReminderEmail(
                user.email,
                reminder.title,
                reminder.description ?? '',
                reminder.reminderDate
              );
            }
          } catch (emailError) {
            logger.warn('Failed to send reminder email:', emailError);
          }

          // Mark as sent
          await reminderRepository.markAsSent(reminder._id.toString());
          processed++;
        } catch (error) {
          logger.error(`Failed to process reminder ${reminder._id}:`, error);
        }
      }

      logger.info(`Processed ${processed} due reminders`);
      return { processed };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Reminder job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Reminder job ${job?.id} failed:`, error);
  });

  return worker;
};

// Schedule reminder checks every 5 minutes
export const scheduleReminderChecks = async (): Promise<void> => {
  try {
    const repeatableJobs = await reminderQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await reminderQueue.removeRepeatableByKey(job.key);
    }

    await reminderQueue.add(
      'check-due-reminders',
      { type: 'check-due-reminders' },
      {
        repeat: {
          every: 5 * 60 * 1000, // Every 5 minutes
        },
      }
    );

    logger.info('Scheduled reminder checks every 5 minutes');
  } catch (error) {
    logger.error('Failed to schedule reminder checks:', error);
  }
};
