import { JobModel } from '../models';
import { IJobDocument, JobStatus } from '../types';
import { logger } from '../../utils/logger';

export class JobLifecycleService {
  /**
   * Transition job to new status.
   */
  async transition(jobId: string, newStatus: JobStatus): Promise<IJobDocument | null> {
    const update: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'updated') {
      update['lastSeenAt'] = new Date();
      update['lastVerifiedAt'] = new Date();
    } else if (newStatus === 'expired' || newStatus === 'removed') {
      update['lastSeenAt'] = new Date();
    }

    return JobModel.findByIdAndUpdate(jobId, { $set: update }, { new: true });
  }

  /**
   * Mark jobs as expired if not verified within N days.
   */
  async expireStaleJobs(daysThreshold = 14): Promise<number> {
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    const result = await JobModel.updateMany(
      {
        status: { $in: ['active', 'updated'] },
        lastVerifiedAt: { $lt: cutoff },
      },
      { $set: { status: 'expired' } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Expired ${result.modifiedCount} stale jobs (not verified in ${daysThreshold} days)`);
    }

    return result.modifiedCount;
  }

  /**
   * Mark job as removed (source returned 404/410).
   */
  async markRemoved(jobId: string): Promise<void> {
    await JobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'removed', lastSeenAt: new Date() },
    });
  }

  /**
   * Update job content (re-crawl detected change).
   */
  async updateContent(
    jobId: string,
    newData: Partial<IJobDocument>
  ): Promise<IJobDocument | null> {
    return JobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          ...newData,
          status: 'updated',
          lastSeenAt: new Date(),
          lastVerifiedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Verify a job still exists (touch lastVerifiedAt).
   */
  async verify(jobId: string): Promise<void> {
    await JobModel.findByIdAndUpdate(jobId, {
      $set: { lastVerifiedAt: new Date(), lastSeenAt: new Date() },
    });
  }

  /**
   * Get jobs needing re-verification by source.
   */
  async getJobsNeedingVerification(sourceId: string, limit = 50): Promise<IJobDocument[]> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    return JobModel.find({
      sourceId,
      status: { $in: ['active', 'updated'] },
      lastVerifiedAt: { $lt: threeDaysAgo },
    })
      .sort({ lastVerifiedAt: 1 })
      .limit(limit);
  }

  /**
   * Get lifecycle stats.
   */
  async getStats(): Promise<Record<JobStatus, number>> {
    const result = await JobModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats: Record<string, number> = {
      discovered: 0, active: 0, updated: 0, expired: 0, removed: 0,
    };

    result.forEach((r: { _id: string; count: number }) => {
      stats[r._id] = r.count;
    });

    return stats as Record<JobStatus, number>;
  }
}

export const jobLifecycleService = new JobLifecycleService();
