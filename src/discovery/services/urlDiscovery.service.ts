import crypto from 'crypto';
import { Types } from 'mongoose';
import { JobUrlModel } from '../models';
import { IJobUrlDocument, DiscoveryMethod, UrlStatus } from '../types';
import { logger } from '../../utils/logger';

// ─── URL Fingerprinting ───────────────────────────────────────────────────────

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params, fragments, trailing slashes
    parsed.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid'].forEach(
      (p) => parsed.searchParams.delete(p)
    );
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url.replace(/\/+$/, '');
  }
}

function computeFingerprint(url: string): string {
  const canonical = canonicalizeUrl(url);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ─── Priority Assignment ──────────────────────────────────────────────────────

function assignPriority(method: DiscoveryMethod, url: string): number {
  // Base priority by discovery method
  const basePriority: Record<DiscoveryMethod, number> = {
    structured_data: 100,
    ats_pattern: 95,
    manual: 90,
    listing_page: 85,
    sitemap: 80,
    feed: 75,
    search: 60,
  };

  let priority = basePriority[method] ?? 50;

  // URL pattern bonus
  const jobUrlPatterns = [
    /\/jobs?\/\d+/i,
    /\/careers?\/\d+/i,
    /\/positions?\/\d+/i,
    /\/openings?\/\d+/i,
    /\/vacancies?\//i,
    /\/apply\//i,
  ];

  if (jobUrlPatterns.some((p) => p.test(url))) {
    priority = Math.min(100, priority + 10);
  }

  return priority;
}

// ─── URL Discovery Service ────────────────────────────────────────────────────

export class UrlDiscoveryService {
  /**
   * Submit a discovered URL for processing.
   * Returns null if URL already exists (deduplication).
   */
  async submitUrl(data: {
    url: string;
    domain: string;
    sourceId: string;
    discoveryMethod: DiscoveryMethod;
    priority?: number;
  }): Promise<IJobUrlDocument | null> {
    const fingerprint = computeFingerprint(data.url);

    // Check if already exists
    const existing = await JobUrlModel.findOne({ urlFingerprint: fingerprint });
    if (existing) {
      return null; // Deduplicated
    }

    const priority = data.priority ?? assignPriority(data.discoveryMethod, data.url);

    try {
      const jobUrl = await JobUrlModel.create({
        url: canonicalizeUrl(data.url),
        urlFingerprint: fingerprint,
        domain: data.domain.toLowerCase(),
        sourceId: new Types.ObjectId(data.sourceId),
        status: 'queued',
        discoveryMethod: data.discoveryMethod,
        priority,
      });

      return jobUrl;
    } catch (error) {
      // Duplicate key error (race condition) — safe to ignore
      if ((error as { code?: number }).code === 11000) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Submit multiple URLs in batch. Returns count of new URLs added.
   */
  async submitBatch(urls: Array<{
    url: string;
    domain: string;
    sourceId: string;
    discoveryMethod: DiscoveryMethod;
  }>): Promise<{ added: number; duplicates: number }> {
    let added = 0;
    let duplicates = 0;

    for (const urlData of urls) {
      const result = await this.submitUrl(urlData);
      if (result) added++;
      else duplicates++;
    }

    if (added > 0) {
      logger.info(`URL batch: ${added} new, ${duplicates} duplicates`);
    }

    return { added, duplicates };
  }

  /**
   * Get next batch of URLs to fetch, respecting domain distribution.
   */
  async getNextFetchBatch(limit = 20): Promise<IJobUrlDocument[]> {
    // Get high-priority queued URLs, distributing across domains
    const urls = await JobUrlModel.aggregate([
      { $match: { status: 'queued' } },
      { $sort: { priority: -1, createdAt: 1 } },
      {
        $group: {
          _id: '$domain',
          docs: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          docs: { $slice: ['$docs', 3] }, // Max 3 per domain per batch
        },
      },
      { $unwind: '$docs' },
      { $replaceRoot: { newRoot: '$docs' } },
      { $sort: { priority: -1 } },
      { $limit: limit },
    ]);

    // Mark them as fetching
    const ids = urls.map((u: { _id: Types.ObjectId }) => u._id);
    if (ids.length > 0) {
      await JobUrlModel.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'fetching' } }
      );
    }

    return urls as unknown as IJobUrlDocument[];
  }

  /**
   * Update URL status after processing.
   */
  async updateStatus(
    id: string,
    status: UrlStatus,
    metadata?: {
      httpStatus?: number;
      contentHash?: string;
      pageType?: string;
      classificationConfidence?: number;
      error?: string;
    }
  ): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (metadata) {
      if (metadata.httpStatus) update['httpStatus'] = metadata.httpStatus;
      if (metadata.contentHash) update['contentHash'] = metadata.contentHash;
      if (metadata.pageType) update['pageType'] = metadata.pageType;
      if (metadata.classificationConfidence) update['classificationConfidence'] = metadata.classificationConfidence;
      if (metadata.error) update['error'] = metadata.error;
    }

    if (status === 'fetched' || status === 'failed') {
      update['lastFetchAt'] = new Date();
      update['$inc'] = { fetchAttempts: 1 };
    }

    await JobUrlModel.findByIdAndUpdate(id, status === 'fetched' || status === 'failed'
      ? { $set: update, $inc: { fetchAttempts: 1 } }
      : { $set: update }
    );
  }

  /**
   * Reset failed URLs for retry (up to max attempts).
   */
  async retryFailed(maxAttempts = 3): Promise<number> {
    const result = await JobUrlModel.updateMany(
      { status: 'failed', fetchAttempts: { $lt: maxAttempts } },
      { $set: { status: 'queued' } }
    );
    return result.modifiedCount;
  }

  /**
   * Get queue stats.
   */
  async getStats(): Promise<Record<UrlStatus, number>> {
    const result = await JobUrlModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats: Record<string, number> = {
      queued: 0, fetching: 0, fetched: 0, classified: 0,
      extracted: 0, indexed: 0, failed: 0, skipped: 0,
    };

    result.forEach((r: { _id: string; count: number }) => {
      stats[r._id] = r.count;
    });

    return stats as Record<UrlStatus, number>;
  }

  /**
   * Clean up old processed URLs (older than 30 days).
   */
  async cleanup(daysOld = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await JobUrlModel.deleteMany({
      status: { $in: ['indexed', 'skipped'] },
      updatedAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }
}

export const urlDiscoveryService = new UrlDiscoveryService();
