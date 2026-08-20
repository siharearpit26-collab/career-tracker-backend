import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { UserModel, ApplicationModel, NotificationModel } from '../models';
import { JobModel } from '../discovery/models';
import { sendWeeklySummaryEmail, sendDeadlineReminderEmail } from '../utils/email.utils';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'weekly-digest';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
};

export const weeklyDigestQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

interface DigestJobData {
  type: 'weekly-summary' | 'deadline-check';
}

export const createWeeklyDigestWorker = (): Worker<DigestJobData> => {
  const worker = new Worker<DigestJobData>(
    QUEUE_NAME,
    async (job: Job<DigestJobData>) => {
      if (job.data.type === 'weekly-summary') {
        return processWeeklySummary();
      }
      if (job.data.type === 'deadline-check') {
        return processDeadlineReminders();
      }
      return { usersNotified: 0 };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('completed', (job) => {
    logger.info(`Digest job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Digest job ${job?.id} failed:`, error);
  });

  return worker;
};

// ─── Weekly Summary ───────────────────────────────────────────────────────────

async function processWeeklySummary(): Promise<{ usersNotified: number }> {
  logger.info('Processing weekly summary emails...');

  const users = await UserModel.find({
    isActive: true,
    'preferences.weeklyDigest': { $ne: false },
  });

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let usersNotified = 0;

  for (const user of users) {
    try {
      const userId = user._id;

      // Gather stats for the week
      const [
        applicationsAdded,
        interviewsScheduled,
        offersReceived,
        rejections,
        totalActive,
        statusUpdates,
        newJobMatches,
      ] = await Promise.all([
        ApplicationModel.countDocuments({
          userId,
          createdAt: { $gte: oneWeekAgo },
        }),
        ApplicationModel.countDocuments({
          userId,
          status: 'Interview Scheduled',
          updatedAt: { $gte: oneWeekAgo },
        }),
        ApplicationModel.countDocuments({
          userId,
          status: 'Offer',
          updatedAt: { $gte: oneWeekAgo },
        }),
        ApplicationModel.countDocuments({
          userId,
          status: 'Rejected',
          updatedAt: { $gte: oneWeekAgo },
        }),
        ApplicationModel.countDocuments({
          userId,
          isArchived: false,
          status: { $nin: ['Rejected', 'Withdrawn'] },
        }),
        NotificationModel.countDocuments({
          userId,
          type: 'application_update',
          createdAt: { $gte: oneWeekAgo },
        }),
        JobModel.countDocuments({
          status: 'active',
          createdAt: { $gte: oneWeekAgo },
        }),
      ]);

      // Skip users with zero activity
      if (applicationsAdded === 0 && statusUpdates === 0 && newJobMatches === 0) {
        continue;
      }

      await sendWeeklySummaryEmail(user.email, user.firstName, {
        applicationsAdded,
        statusUpdates,
        interviewsScheduled,
        offersReceived,
        rejections,
        totalActive,
        newJobMatches,
      });

      usersNotified++;
    } catch (error) {
      logger.warn(`Failed to send weekly summary to ${user.email}:`, error);
    }
  }

  logger.info(`Weekly summary sent to ${usersNotified} users`);
  return { usersNotified };
}

// ─── Deadline Reminders ───────────────────────────────────────────────────────

async function processDeadlineReminders(): Promise<{ usersNotified: number }> {
  logger.info('Processing deadline reminders...');

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find applications with deadlines in the next 3 days
  const appsWithDeadlines = await ApplicationModel.find({
    deadline: { $gte: now, $lte: threeDaysFromNow },
    isArchived: false,
    status: { $nin: ['Rejected', 'Withdrawn'] },
  }).populate('userId', 'email firstName preferences');

  // Group by user
  const byUser = new Map<string, Array<{ company: string; jobTitle: string; deadline: Date; id: string }>>();

  for (const app of appsWithDeadlines) {
    const userObj = app.userId as unknown as {
      _id: { toString(): string };
      email: string;
      firstName: string;
      preferences?: { emailNotifications?: boolean };
    };

    if (!userObj?.email || userObj.preferences?.emailNotifications === false) continue;

    const uid = userObj._id.toString();
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push({
      company: app.company,
      jobTitle: app.jobTitle,
      deadline: app.deadline!,
      id: app._id.toString(),
    });
  }

  let usersNotified = 0;

  for (const [, apps] of byUser.entries()) {
    const userObj = (appsWithDeadlines.find(
      (a) => (a.userId as unknown as { _id: { toString(): string } })._id.toString() ===
        apps[0]!.id
    )?.userId) as unknown as { email: string; firstName: string } | undefined;

    // Fallback: get user from first app
    const firstApp = appsWithDeadlines.find((a) => a._id.toString() === apps[0]!.id);
    const user = userObj ?? (firstApp?.userId as unknown as { email: string; firstName: string });

    if (!user) continue;

    try {
      await sendDeadlineReminderEmail(user.email, user.firstName, apps);
      usersNotified++;
    } catch (error) {
      logger.warn(`Failed to send deadline reminder to ${user.email}:`, error);
    }
  }

  logger.info(`Deadline reminders sent to ${usersNotified} users`);
  return { usersNotified };
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const scheduleWeeklyDigest = async (): Promise<void> => {
  try {
    // Remove existing repeatable jobs
    const repeatableJobs = await weeklyDigestQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await weeklyDigestQueue.removeRepeatableByKey(job.key);
    }

    // Weekly summary — every Monday at 9 AM
    await weeklyDigestQueue.add(
      'weekly-summary',
      { type: 'weekly-summary' },
      {
        repeat: {
          pattern: '0 9 * * 1', // Cron: Monday 9 AM
        },
      }
    );

    // Deadline check — every day at 8 AM
    await weeklyDigestQueue.add(
      'deadline-check',
      { type: 'deadline-check' },
      {
        repeat: {
          pattern: '0 8 * * *', // Cron: every day 8 AM
        },
      }
    );

    logger.info('Scheduled weekly digest (Mon 9AM) and deadline checks (daily 8AM)');
  } catch (error) {
    logger.error('Failed to schedule weekly digest:', error);
  }
};
