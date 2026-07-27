import mongoose, { Schema } from 'mongoose';
import { IApplicationDocument, InterviewStage } from '../types';

const interviewStageSchema = new Schema<InterviewStage>(
  {
    type: {
      type: String,
      enum: ['Phone Screen', 'Technical', 'HR', 'On-site', 'Final', 'Other'],
      required: true,
    },
    date: { type: Date },
    notes: { type: String, maxlength: 1000 },
    outcome: {
      type: String,
      enum: ['Passed', 'Failed', 'Pending', 'Cancelled'],
    },
  },
  { _id: true }
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Application:
 *       type: object
 *       required:
 *         - company
 *         - jobTitle
 *       properties:
 *         id:
 *           type: string
 *         company:
 *           type: string
 *         jobTitle:
 *           type: string
 *         location:
 *           type: string
 *         appliedDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [Applied, Shortlisted, Interview Scheduled, Interview Completed, Offer, Rejected, Withdrawn]
 *         source:
 *           type: string
 *           enum: [LinkedIn, Indeed, Company Website, Referral, Job Fair, Recruiter, Other]
 *         notes:
 *           type: string
 *         jobUrl:
 *           type: string
 *         salaryMin:
 *           type: number
 *         salaryMax:
 *           type: number
 *         salaryCurrency:
 *           type: string
 *         deadline:
 *           type: string
 *           format: date-time
 *         isArchived:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */
const applicationSchema = new Schema<IApplicationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    jobTitle: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: [
        'LinkedIn',
        'Indeed',
        'Company Website',
        'Referral',
        'Job Fair',
        'Recruiter',
        'Other',
      ],
    },
    status: {
      type: String,
      enum: [
        'Applied',
        'Shortlisted',
        'Interview Scheduled',
        'Interview Completed',
        'Offer',
        'Rejected',
        'Withdrawn',
      ],
      default: 'Applied',
    },
    notes: {
      type: String,
      maxlength: [5000, 'Notes cannot exceed 5000 characters'],
    },
    jobUrl: {
      type: String,
      trim: true,
    },
    resumeVersion: {
      type: String,
      trim: true,
      maxlength: [100, 'Resume version cannot exceed 100 characters'],
    },
    salaryMin: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
    },
    salaryMax: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
    },
    salaryCurrency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    deadline: { type: Date },
    interviewStages: {
      type: [interviewStageSchema],
      default: [],
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const record = ret as Record<string, unknown>;
        record['id'] = record['_id'];
        delete record['_id'];
        delete record['__v'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes for search and filtering
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ userId: 1, appliedDate: -1 });
applicationSchema.index({ userId: 1, company: 1 });
applicationSchema.index({ userId: 1, isArchived: 1 });
applicationSchema.index({ company: 'text', jobTitle: 'text', location: 'text' });

const ApplicationModel = mongoose.model<IApplicationDocument>(
  'Application',
  applicationSchema
);

export default ApplicationModel;
