import { Types } from 'mongoose';
import { JobAlertModel, JobModel } from '../models';
import { IJobAlertDocument, IJobDocument } from '../types';
import { notificationRepository } from '../../repositories/notification.repository';
import { sendEmail } from '../../utils/email.utils';
import { userRepository } from '../../repositories/user.repository';
import { logger } from '../../utils/logger';

export class JobAlertsService {
  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async create(userId: string, data: {
    name: string;
    criteria: {
      keywords?: string[];
      locations?: string[];
      skills?: string[];
      employmentTypes?: string[];
      workArrangement?: string[];
      experienceMin?: number;
      experienceMax?: number;
      salaryMin?: number;
      salaryCurrency?: string;
    };
    minimumMatchScore?: number;
    frequency?: 'immediate' | 'daily' | 'weekly';
  }): Promise<IJobAlertDocument> {
    // Max 10 alerts per user
    const count = await JobAlertModel.countDocuments({ userId: new Types.ObjectId(userId) });
    if (count >= 10) {
      throw new Error('Maximum 10 alerts allowed');
    }

    return JobAlertModel.create({
      userId: new Types.ObjectId(userId),
      name: data.name,
      criteria: data.criteria,
      minimumMatchScore: data.minimumMatchScore ?? 50,
      frequency: data.frequency ?? 'daily',
    });
  }

  async getByUserId(userId: string): Promise<IJobAlertDocument[]> {
    return JobAlertModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async update(id: string, userId: string, data: Partial<{
    name: string;
    criteria: Record<string, unknown>;
    minimumMatchScore: number;
    frequency: string;
    isActive: boolean;
  }>): Promise<IJobAlertDocument | null> {
    return JobAlertModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true }
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await JobAlertModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  // ─── Alert Processing ───────────────────────────────────────────────────────

  /**
   * Process daily alerts — find matching jobs from last 24h and notify users.
   */
  async processDailyAlerts(): Promise<number> {
    const alerts = await JobAlertModel.find({ isActive: true, frequency: 'daily' });
    let notified = 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const alert of alerts) {
      try {
        const matches = await this.findMatchingJobs(alert, oneDayAgo);

        if (matches.length === 0) continue;

        // Create in-app notification
        await notificationRepository.create({
          userId: alert.userId.toString(),
          title: `${matches.length} new jobs match "${alert.name}"`,
          message: `We found ${matches.length} new jobs matching your alert. Top match: ${matches[0]!.title} at ${matches[0]!.company}`,
          type: 'system',
        });

        // Send email digest
        await this.sendDigestEmail(alert, matches, 'daily');

        // Update lastNotifiedAt
        alert.lastNotifiedAt = new Date();
        await alert.save();

        notified++;
      } catch (error) {
        logger.error(`Failed to process alert ${alert._id}:`, error);
      }
    }

    if (notified > 0) logger.info(`Processed ${notified} daily job alerts`);
    return notified;
  }

  /**
   * Process weekly alerts.
   */
  async processWeeklyAlerts(): Promise<number> {
    const alerts = await JobAlertModel.find({ isActive: true, frequency: 'weekly' });
    let notified = 0;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const alert of alerts) {
      try {
        const matches = await this.findMatchingJobs(alert, oneWeekAgo);
        if (matches.length === 0) continue;

        await notificationRepository.create({
          userId: alert.userId.toString(),
          title: `Weekly: ${matches.length} jobs match "${alert.name}"`,
          message: `This week we found ${matches.length} jobs matching your criteria.`,
          type: 'system',
        });

        await this.sendDigestEmail(alert, matches, 'weekly');

        alert.lastNotifiedAt = new Date();
        await alert.save();
        notified++;
      } catch (error) {
        logger.error(`Failed to process weekly alert ${alert._id}:`, error);
      }
    }

    return notified;
  }

  /**
   * Check a newly indexed job against all immediate alerts.
   */
  async checkImmediateAlerts(job: IJobDocument): Promise<void> {
    const alerts = await JobAlertModel.find({ isActive: true, frequency: 'immediate' });

    for (const alert of alerts) {
      if (this.jobMatchesAlert(job, alert)) {
        await notificationRepository.create({
          userId: alert.userId.toString(),
          title: `New match: ${job.title} at ${job.company}`,
          message: `A new job matching your "${alert.name}" alert was just discovered.`,
          type: 'system',
        });
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async findMatchingJobs(
    alert: IJobAlertDocument,
    since: Date
  ): Promise<IJobDocument[]> {
    const query: Record<string, unknown> = {
      status: { $in: ['active', 'updated'] },
      createdAt: { $gte: since },
    };

    const criteria = alert.criteria;

    if (criteria.keywords?.length) {
      query['$text'] = { $search: criteria.keywords.join(' ') };
    }

    if (criteria.locations?.length) {
      query['$or'] = criteria.locations.map((loc) => ({
        'locations.city': { $regex: loc, $options: 'i' },
      }));
    }

    if (criteria.skills?.length) {
      query['skillsNormalized'] = { $in: criteria.skills };
    }

    if (criteria.employmentTypes?.length) {
      query['employmentType'] = { $in: criteria.employmentTypes };
    }

    if (criteria.experienceMax !== undefined) {
      query['experienceRange.min'] = { $lte: criteria.experienceMax };
    }

    if (criteria.salaryMin) {
      query['salary.max'] = { $gte: criteria.salaryMin };
    }

    return JobModel.find(query).sort({ sourcePostedAt: -1 }).limit(50);
  }

  private jobMatchesAlert(job: IJobDocument, alert: IJobAlertDocument): boolean {
    const c = alert.criteria;

    if (c.keywords?.length) {
      const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
      const hasKeyword = c.keywords.some((k) => text.includes(k.toLowerCase()));
      if (!hasKeyword) return false;
    }

    if (c.skills?.length) {
      const jobSkills = job.skillsNormalized.map((s) => s.toLowerCase());
      const hasSkill = c.skills.some((s) => jobSkills.includes(s.toLowerCase()));
      if (!hasSkill) return false;
    }

    if (c.locations?.length) {
      const jobLocs = job.locations.map((l) => `${l.city ?? ''} ${l.country ?? ''}`.toLowerCase());
      const hasLoc = c.locations.some((loc) => jobLocs.some((jl) => jl.includes(loc.toLowerCase())));
      if (!hasLoc) return false;
    }

    return true;
  }

  private async sendDigestEmail(
    alert: IJobAlertDocument,
    jobs: IJobDocument[],
    period: 'daily' | 'weekly'
  ): Promise<void> {
    try {
      const user = await userRepository.findById(alert.userId.toString());
      if (!user || user.preferences?.emailNotifications === false) return;

      const jobList = jobs.slice(0, 5).map((j) =>
        `• ${j.title} at ${j.company} (${j.locations[0]?.city ?? 'Location N/A'})`
      ).join('\n');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">CareerTracker ${period === 'daily' ? 'Daily' : 'Weekly'} Job Alert</h2>
          <p>Hi ${user.firstName},</p>
          <p>We found <strong>${jobs.length} new jobs</strong> matching your "<strong>${alert.name}</strong>" alert:</p>
          <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <pre style="font-family: inherit; white-space: pre-wrap;">${jobList}</pre>
          </div>
          ${jobs.length > 5 ? `<p>...and ${jobs.length - 5} more</p>` : ''}
          <a href="${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/jobs"
             style="display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 10px;">
            View All Jobs →
          </a>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: `${period === 'daily' ? 'Daily' : 'Weekly'} Job Alert: ${jobs.length} new matches for "${alert.name}"`,
        html,
      });
    } catch (error) {
      logger.warn('Failed to send alert digest email:', error);
    }
  }
}

export const jobAlertsService = new JobAlertsService();
