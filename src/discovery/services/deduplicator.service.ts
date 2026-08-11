import crypto from 'crypto';
import { JobModel } from '../models';
import { IJobDocument } from '../types';
import { logger } from '../../utils/logger';

export interface DeduplicationResult {
  isDuplicate: boolean;
  confidence: number;
  method: 'source_id' | 'canonical_url' | 'fingerprint' | 'similarity' | 'none';
  existingJobId?: string;
}

// ─── Fingerprint Generation ───────────────────────────────────────────────────

export function generateJobFingerprint(
  companyNormalized: string,
  titleNormalized: string,
  location: string,
  descriptionSnippet: string
): string {
  const normalized = [
    companyNormalized.toLowerCase().trim(),
    titleNormalized.toLowerCase().trim(),
    location.toLowerCase().trim(),
    descriptionSnippet.slice(0, 500).toLowerCase().replace(/\s+/g, ' ').trim(),
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ─── Text Similarity ──────────────────────────────────────────────────────────

function computeSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  words1.forEach((w) => { if (words2.has(w)) intersection++; });

  // Jaccard similarity
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ─── Main Deduplication Service ───────────────────────────────────────────────

export class DeduplicatorService {
  /**
   * Check if a job is a duplicate using 4-level detection.
   */
  async checkDuplicate(data: {
    sourceId: string;
    sourceJobId?: string;
    sourceUrl: string;
    companyNormalized: string;
    title: string;
    location: string;
    description: string;
    jobFingerprint: string;
  }): Promise<DeduplicationResult> {
    // Level 1: Exact source ID match
    if (data.sourceJobId) {
      const existing = await JobModel.findOne({
        sourceId: data.sourceId,
        sourceJobId: data.sourceJobId,
      });
      if (existing) {
        return {
          isDuplicate: true,
          confidence: 100,
          method: 'source_id',
          existingJobId: existing._id.toString(),
        };
      }
    }

    // Level 2: Canonical URL match
    const urlMatch = await JobModel.findOne({
      $or: [
        { sourceUrl: data.sourceUrl },
        { alternateSourceUrls: data.sourceUrl },
      ],
    });
    if (urlMatch) {
      return {
        isDuplicate: true,
        confidence: 99,
        method: 'canonical_url',
        existingJobId: urlMatch._id.toString(),
      };
    }

    // Level 3: Content fingerprint match
    const fingerprintMatch = await JobModel.findOne({
      jobFingerprint: data.jobFingerprint,
    });
    if (fingerprintMatch) {
      return {
        isDuplicate: true,
        confidence: 95,
        method: 'fingerprint',
        existingJobId: fingerprintMatch._id.toString(),
      };
    }

    // Level 4: Similarity matching (same company, posted within 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const candidates = await JobModel.find({
      companyNormalized: data.companyNormalized,
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['active', 'updated'] },
    }).limit(20);

    for (const candidate of candidates) {
      const titleSim = computeSimilarity(data.title, candidate.title);
      const descSim = computeSimilarity(
        data.description.slice(0, 1000),
        candidate.description.slice(0, 1000)
      );

      // Weighted similarity: title 40% + description 60%
      const combined = titleSim * 0.4 + descSim * 0.6;

      if (combined >= 0.85) {
        const confidence = Math.round(combined * 100);
        logger.info(
          `Duplicate detected (similarity ${confidence}%): "${data.title}" ≈ "${candidate.title}" at ${data.companyNormalized}`
        );
        return {
          isDuplicate: true,
          confidence,
          method: 'similarity',
          existingJobId: candidate._id.toString(),
        };
      }
    }

    return { isDuplicate: false, confidence: 0, method: 'none' };
  }

  /**
   * Merge a new source URL into an existing job as an alternate source.
   */
  async mergeSource(existingJobId: string, newSourceUrl: string): Promise<void> {
    await JobModel.findByIdAndUpdate(existingJobId, {
      $addToSet: { alternateSourceUrls: newSourceUrl },
      $set: { lastSeenAt: new Date(), lastVerifiedAt: new Date() },
    });
  }

  /**
   * Mark a job as a duplicate of another.
   */
  async markDuplicate(jobId: string, duplicateOfId: string): Promise<void> {
    await JobModel.findByIdAndUpdate(jobId, {
      $set: { duplicateOf: duplicateOfId, status: 'removed' },
    });
  }
}

export const deduplicatorService = new DeduplicatorService();
