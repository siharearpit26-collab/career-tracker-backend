import mongoose, { Schema } from 'mongoose';
import { IJobDocument } from '../types';

const jobLocationSchema = new Schema(
  {
    raw: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    workArrangement: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
  },
  { _id: false }
);

const salarySchema = new Schema(
  {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String },
    period: { type: String, enum: ['hourly', 'monthly', 'annual'] },
  },
  { _id: false }
);

const experienceSchema = new Schema(
  { min: { type: Number }, max: { type: Number } },
  { _id: false }
);

const jobSchema = new Schema<IJobDocument>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: 'JobSource', required: true, index: true },
    sourceUrl: { type: String, required: true },
    sourceJobId: { type: String },
    applicationUrl: { type: String },
    jobFingerprint: { type: String, required: true, index: true },

    rawTitle: { type: String, required: true },
    rawCompany: { type: String, required: true },
    rawLocation: { type: String },
    rawDescription: { type: String },

    title: { type: String, required: true },
    company: { type: String, required: true },
    companyNormalized: { type: String, required: true, index: true },
    description: { type: String, required: true },
    locations: { type: [jobLocationSchema], default: [] },
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'OTHER'],
      default: 'FULL_TIME',
    },
    seniority: {
      type: String,
      enum: ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'director', 'vp', 'unknown'],
      default: 'unknown',
    },
    experienceRange: { type: experienceSchema, default: () => ({}) },
    salary: { type: salarySchema, default: () => ({}) },
    skills: { type: [String], default: [] },
    skillsNormalized: { type: [String], default: [], index: true },

    status: {
      type: String,
      enum: ['discovered', 'active', 'updated', 'expired', 'removed'],
      default: 'active',
      index: true,
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    sourcePostedAt: { type: Date },
    lastVerifiedAt: { type: Date, default: Date.now },

    extractionMethod: {
      type: String,
      enum: ['json_ld', 'opengraph', 'html_semantic', 'ats_adapter', 'ai_extraction'],
      required: true,
    },
    extractionConfidence: { type: Number, default: 0, min: 0, max: 100 },
    alternateSourceUrls: { type: [String], default: [] },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Job' },
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

// Search indexes
jobSchema.index({ title: 'text', company: 'text', description: 'text', skills: 'text' });
jobSchema.index({ companyNormalized: 1, title: 1 });
jobSchema.index({ status: 1, lastVerifiedAt: -1 });
jobSchema.index({ 'locations.city': 1, status: 1 });
jobSchema.index({ skillsNormalized: 1, status: 1 });
jobSchema.index({ sourcePostedAt: -1 });
jobSchema.index({ sourceId: 1, sourceJobId: 1 });

export default mongoose.model<IJobDocument>('Job', jobSchema);
