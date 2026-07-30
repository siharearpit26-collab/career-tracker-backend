import mongoose, { Schema } from 'mongoose';
import { IEmailAccountDocument } from '../types';

const emailAccountSchema = new Schema<IEmailAccountDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['gmail', 'outlook'],
      required: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    accessToken: {
      type: String,
      required: true,
      select: false,
    },
    refreshToken: {
      type: String,
      required: true,
      select: false,
    },
    tokenExpiresAt: {
      type: Date,
      required: true,
    },
    lastSyncedAt: {
      type: Date,
    },
    syncCursor: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
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
        delete record['accessToken'];
        delete record['refreshToken'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

emailAccountSchema.index({ userId: 1, provider: 1 });
emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

const EmailAccountModel = mongoose.model<IEmailAccountDocument>(
  'EmailAccount',
  emailAccountSchema
);

export default EmailAccountModel;
