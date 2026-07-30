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
    messageId: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Subject cannot exceed 500 characters'],
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    receivedAt: {
      type: Date,
      required: true,
    },
    snippet: {
      type: String,
      maxlength: [1000, 'Snippet cannot exceed 1000 characters'],
    },
    classification: {
      type: String,
      enum: ['recruitment', 'rejection', 'offer', 'interview', 'follow_up', 'unrelated'],
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
    },
    statusUpdate: {
      type: String,
    },
    isConfirmed: {
      type: Boolean,
      default: false,
    },
    processedAt: {
      type: Date,
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

emailSyncSchema.index({ userId: 1, receivedAt: -1 });
emailSyncSchema.index({ emailAccountId: 1, messageId: 1 }, { unique: true });
emailSyncSchema.index({ userId: 1, classification: 1 });
emailSyncSchema.index({ userId: 1, isConfirmed: 1 });

const EmailSyncModel = mongoose.model<IEmailSyncDocument>(
  'EmailSync',
  emailSyncSchema
);

export default EmailSyncModel;
