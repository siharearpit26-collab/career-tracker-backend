import mongoose, { Schema } from 'mongoose';
import { IJobSourceDocument } from '../types';

const crawlPolicySchema = new Schema(
  {
    maxRequestsPerMinute: { type: Number, default: 30 },
    crawlBudgetPerDay: { type: Number, default: 1000 },
    respectRobots: { type: Boolean, default: true },
    requiresBrowserRendering: { type: Boolean, default: false },
    scheduleHours: { type: Number, default: 24 },
    concurrency: { type: Number, default: 2 },
  },
  { _id: false }
);

const jobSourceSchema = new Schema<IJobSourceDocument>(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    sourceType: {
      type: String,
      enum: ['website', 'api', 'feed', 'ats_platform'],
      required: true,
    },
    accessMethod: {
      type: String,
      enum: ['public_page', 'sitemap', 'api', 'rss', 'structured_data'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'degraded', 'temporarily_disabled', 'disabled'],
      default: 'active',
    },
    robotsStatus: {
      type: String,
      enum: ['allowed', 'restricted', 'unknown'],
      default: 'unknown',
    },
    crawlPolicy: {
      type: crawlPolicySchema,
      default: () => ({}),
    },
    qualityScore: { type: Number, default: 50, min: 0, max: 100 },
    lastCrawledAt: { type: Date },
    lastSuccessfulCrawlAt: { type: Date },
    failureCount: { type: Number, default: 0 },
    consecutiveFailures: { type: Number, default: 0 },
    totalJobsDiscovered: { type: Number, default: 0 },
    totalValidJobs: { type: Number, default: 0 },
    discoveredAt: { type: Date, default: Date.now },
    disabledReason: { type: String },
    complianceNotes: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const r = ret as Record<string, unknown>;
        r['id'] = r['_id'];
        delete r['_id'];
        delete r['__v'];
        return ret;
      },
    },
  }
);

jobSourceSchema.index({ status: 1, qualityScore: -1 });
jobSourceSchema.index({ domain: 1 }, { unique: true });
jobSourceSchema.index({ lastCrawledAt: 1 });

export default mongoose.model<IJobSourceDocument>('JobSource', jobSourceSchema);
