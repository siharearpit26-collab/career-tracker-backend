import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISettings {
  userId: Types.ObjectId;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  emailNotifications: boolean;
  reminderNotifications: boolean;
  weeklyDigest: boolean;
  defaultCurrency: string;
  dateFormat: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsDocument extends ISettings, Document {
  _id: Types.ObjectId;
}

const settingsSchema = new Schema<ISettingsDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    emailNotifications: { type: Boolean, default: true },
    reminderNotifications: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    defaultCurrency: { type: String, default: 'USD', uppercase: true },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
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

settingsSchema.index({ userId: 1 }, { unique: true });

const SettingsModel = mongoose.model<ISettingsDocument>('Settings', settingsSchema);

export default SettingsModel;
