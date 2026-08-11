import { Types } from 'mongoose';
import { JobSourceModel } from '../models';
import { IJobSourceDocument, SourceStatus, CrawlPolicy } from '../types';
import { logger } from '../../utils/logger';

export class SourceRegistryService {
  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async addSource(data: {
    domain: string;
    sourceType: 'website' | 'api' | 'feed' | 'ats_platform';
    accessMethod: 'public_page' | 'sitemap' | 'api' | 'rss' | 'structured_data';
    crawlPolicy?: Partial<CrawlPolicy>;
    complianceNotes?: string;
  }): Promise<IJobSourceDocument> {
    const domain = data.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

    const existing = await JobSourceModel.findOne({ domain });
    if (existing) {
      // Reactivate if disabled
      if (existing.status === 'disabled' || existing.status === 'temporarily_disabled') {
        existing.status = 'active';
        existing.consecutiveFailures = 0;
        await existing.save();
        logger.info(`Reactivated source: ${domain}`);
        return existing;
      }
      return existing;
    }

    const source = await JobSourceModel.create({
      domain,
      sourceType: data.sourceType,
      accessMethod: data.accessMethod,
      crawlPolicy: {
        maxRequestsPerMinute: 30,
        crawlBudgetPerDay: 1000,
        respectRobots: true,
        requiresBrowserRendering: false,
        scheduleHours: 24,
        concurrency: 2,
        ...data.crawlPolicy,
      },
      complianceNotes: data.complianceNotes,
      discoveredAt: new Date(),
    });

    logger.info(`New source registered: ${domain} (${data.sourceType})`);
    return source;
  }

  async getById(id: string): Promise<IJobSourceDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return JobSourceModel.findById(id);
  }

  async getByDomain(domain: string): Promise<IJobSourceDocument | null> {
    return JobSourceModel.findOne({ domain: domain.toLowerCase() });
  }

  async getAll(filters: {
    status?: SourceStatus;
    sourceType?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: IJobSourceDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filters.status) query['status'] = filters.status;
    if (filters.sourceType) query['sourceType'] = filters.sourceType;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortField = filters.sortBy ?? 'qualityScore';
    const sortDir = filters.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      JobSourceModel.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit),
      JobSourceModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async update(
    id: string,
    data: Partial<{
      crawlPolicy: Partial<CrawlPolicy>;
      status: SourceStatus;
      complianceNotes: string;
      disabledReason: string;
    }>
  ): Promise<IJobSourceDocument | null> {
    const update: Record<string, unknown> = {};

    if (data.status) update['status'] = data.status;
    if (data.complianceNotes) update['complianceNotes'] = data.complianceNotes;
    if (data.disabledReason) update['disabledReason'] = data.disabledReason;

    if (data.crawlPolicy) {
      for (const [key, value] of Object.entries(data.crawlPolicy)) {
        update[`crawlPolicy.${key}`] = value;
      }
    }

    return JobSourceModel.findByIdAndUpdate(id, { $set: update }, { new: true });
  }

  async disable(id: string, reason: string): Promise<IJobSourceDocument | null> {
    return JobSourceModel.findByIdAndUpdate(
      id,
      { $set: { status: 'disabled', disabledReason: reason } },
      { new: true }
    );
  }

  // ─── Health & Quality ───────────────────────────────────────────────────────

  async recordSuccess(domain: string): Promise<void> {
    await JobSourceModel.findOneAndUpdate(
      { domain },
      {
        $set: {
          lastCrawledAt: new Date(),
          lastSuccessfulCrawlAt: new Date(),
          consecutiveFailures: 0,
        },
        $inc: { totalJobsDiscovered: 1 },
      }
    );
  }

  async recordValidJob(domain: string): Promise<void> {
    await JobSourceModel.findOneAndUpdate(
      { domain },
      { $inc: { totalValidJobs: 1 } }
    );
  }

  async recordFailure(domain: string, error?: string): Promise<void> {
    const source = await JobSourceModel.findOneAndUpdate(
      { domain },
      {
        $set: { lastCrawledAt: new Date() },
        $inc: { failureCount: 1, consecutiveFailures: 1 },
      },
      { new: true }
    );

    if (!source) return;

    // Circuit breaker: degrade after 5 consecutive failures
    if (source.consecutiveFailures >= 5 && source.status === 'active') {
      source.status = 'degraded';
      await source.save();
      logger.warn(`Source degraded: ${domain} (${source.consecutiveFailures} consecutive failures)`);
    }

    // Disable after 24h of degraded state with continued failures
    if (source.consecutiveFailures >= 20 && source.status === 'degraded') {
      source.status = 'temporarily_disabled';
      source.disabledReason = `Auto-disabled: ${source.consecutiveFailures} consecutive failures. Last error: ${error ?? 'unknown'}`;
      await source.save();
      logger.error(`Source temporarily disabled: ${domain}`);
    }
  }

  async recalculateQuality(domain: string): Promise<void> {
    const source = await JobSourceModel.findOne({ domain });
    if (!source) return;

    const total = source.totalJobsDiscovered || 1;
    const valid = source.totalValidJobs || 0;
    const validRate = (valid / total) * 100;
    const failureRate = (source.failureCount / Math.max(total, 1)) * 100;
    const recency = source.lastSuccessfulCrawlAt
      ? Math.max(0, 100 - (Date.now() - source.lastSuccessfulCrawlAt.getTime()) / (24 * 60 * 60 * 1000) * 5)
      : 20;

    const quality = Math.round(
      validRate * 0.5 + (100 - failureRate) * 0.3 + recency * 0.2
    );

    source.qualityScore = Math.max(0, Math.min(100, quality));
    await source.save();
  }

  // ─── Discovery Helpers ──────────────────────────────────────────────────────

  async getActiveSources(): Promise<IJobSourceDocument[]> {
    return JobSourceModel.find({
      status: { $in: ['active', 'degraded'] },
    }).sort({ qualityScore: -1 });
  }

  async getSourcesDueCrawl(): Promise<IJobSourceDocument[]> {
    const now = new Date();

    return JobSourceModel.find({
      status: 'active',
      $or: [
        { lastCrawledAt: null },
        {
          $expr: {
            $lt: [
              '$lastCrawledAt',
              { $subtract: [now, { $multiply: ['$crawlPolicy.scheduleHours', 60 * 60 * 1000] }] },
            ],
          },
        },
      ],
    }).sort({ qualityScore: -1, lastCrawledAt: 1 }).limit(50);
  }

  async getStats(): Promise<{
    totalSources: number;
    activeSources: number;
    degradedSources: number;
    disabledSources: number;
    totalJobsDiscovered: number;
    averageQuality: number;
  }> {
    const [total, active, degraded, disabled, aggregate] = await Promise.all([
      JobSourceModel.countDocuments(),
      JobSourceModel.countDocuments({ status: 'active' }),
      JobSourceModel.countDocuments({ status: 'degraded' }),
      JobSourceModel.countDocuments({ status: { $in: ['disabled', 'temporarily_disabled'] } }),
      JobSourceModel.aggregate([
        { $group: { _id: null, totalJobs: { $sum: '$totalJobsDiscovered' }, avgQuality: { $avg: '$qualityScore' } } },
      ]),
    ]);

    return {
      totalSources: total,
      activeSources: active,
      degradedSources: degraded,
      disabledSources: disabled,
      totalJobsDiscovered: aggregate[0]?.totalJobs ?? 0,
      averageQuality: Math.round(aggregate[0]?.avgQuality ?? 0),
    };
  }
}

export const sourceRegistryService = new SourceRegistryService();
