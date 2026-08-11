import mongoose, { Schema } from 'mongoose';
import { IJobAlertDocument } from '../types';

const alertCriteriaSchema = new Schema(
  {
    keywords: { type: [String], default: [] },
    locations: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    employmentTypes: { type: [String], default: [] },
    workArrangement: { type: [String], default: [] },
    experienceMin: { type: Number },
    experienceMax: { type: Number },
    salaryMin: { type: Number },
    salaryCurrency: { type: String },
  },
  { _id: false }
);

const jobAlertSchema = new Schema<IJobAlertDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    criteria: { type: alertCriteriaSchema, required: true },
    minimumMatchScore: { type: Number, default: 50, min: 0, max: 100 },
    frequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'daily',
    },
    isActive: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date },
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

jobAlertSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<IJobAlertDocument>('JobAlert', jobAlertSchema);
