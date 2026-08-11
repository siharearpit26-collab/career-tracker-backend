import mongoose, { Schema } from 'mongoose';
import { IJobUrlDocument } from '../types';

const jobUrlSchema = new Schema<IJobUrlDocument>(
  {
    url: { type: String, required: true },
    urlFingerprint: { type: String, required: true, index: true },
    domain: { type: String, required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'JobSource', required: true },
    status: {
      type: String,
      enum: ['queued', 'fetching', 'fetched', 'classified', 'extracted', 'indexed', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    discoveryMethod: {
      type: String,
      enum: ['sitemap', 'search', 'structured_data', 'ats_pattern', 'listing_page', 'manual', 'feed'],
      required: true,
    },
    priority: { type: Number, default: 50, min: 0, max: 100 },
    fetchAttempts: { type: Number, default: 0 },
    lastFetchAt: { type: Date },
    httpStatus: { type: Number },
    contentHash: { type: String },
    pageType: {
      type: String,
      enum: ['individual_job', 'job_listing_page', 'company_careers_page', 'search_page', 'irrelevant', 'unknown'],
    },
    classificationConfidence: { type: Number },
    error: { type: String },
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

jobUrlSchema.index({ urlFingerprint: 1 }, { unique: true });
jobUrlSchema.index({ domain: 1, status: 1 });
jobUrlSchema.index({ priority: -1, status: 1 });
jobUrlSchema.index({ sourceId: 1, status: 1 });

export default mongoose.model<IJobUrlDocument>('JobUrl', jobUrlSchema);
