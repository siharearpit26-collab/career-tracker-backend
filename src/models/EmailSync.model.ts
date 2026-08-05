import mongoose, { Schema } from 'mongoose';
import { IEmailSyncDocument } from '../types';

const emailSyncSchema = new Schema<IEmailSyncDocument>(
  {
    emailAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailAccount',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messageId: { type: String, required: true },
    threadId: { type: String },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Subject cannot exceed 500 characters'],
    },
    from: { type: String, required: true, trim: true },
    receivedAt: { type: Date, required: true },
    snippet: { type: String, maxlength: [1000, 'Snippet cannot exceed 1000 characters'] },
    classification: {
      type: String,
      enum: ['recruitment', 'rejection', 'offer', 'interview', 'follow_up', 'unrelated'],
      required: true,
    },
    category: {
      type: String,
      enum: [
        'application_received', 'application_viewed', 'shortlisted',
        'assessment_sent', 'assessment_completed',
        'phone_screen_scheduled', 'phone_screen_completed',
        'technical_interview_scheduled', 'technical_interview_completed',
        'onsite_interview_scheduled', 'onsite_interview_completed',
        'offer_extended', 'offer_accepted', 'rejection', 'follow_up', 'unknown',
      ],
    },
    confidence: { type: Number, min: 0, max: 1, required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    statusUpdate: { type: String },
    isConfirmed: { type: Boolean, default: false },
    isPendingReview: { type: Boolean, default: false },
    processingMethod: { type: String, enum: ['ai', 'rule_based', 'pre_filter'] },
    fallbackReason: { type: String },
    recruiterName: { type: String },
    recruiterEmail: { type: String },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    salaryCurrency: { type: String },
    location: { type: String },
    requiredAction: { type: String },
    summary: { type: String, maxlength: [500] },
    importantDates: { type: Schema.Types.Mixed },
    processedAt: { type: Date },
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

emailSyncSchema.index({ userId: 1, receivedAt: -1 });
emailSyncSchema.index({ emailAccountId: 1, messageId: 1 }, { unique: true });
emailSyncSchema.index({ userId: 1, classification: 1 });
emailSyncSchema.index({ userId: 1, isConfirmed: 1 });
emailSyncSchema.index({ userId: 1, isPendingReview: 1 });
emailSyncSchema.index({ threadId: 1, userId: 1 });

const EmailSyncModel = mongoose.model<IEmailSyncDocument>('EmailSync', emailSyncSchema);

export default EmailSyncModel;
