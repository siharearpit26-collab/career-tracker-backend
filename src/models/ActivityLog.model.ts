import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivityLog {
  userId?: Types.ObjectId;
  action: string;
  entity?: string;
  entityId?: Types.ObjectId;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  level: 'info' | 'warn' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface IActivityLogDocument extends IActivityLog, Document {
  _id: Types.ObjectId;
}

const activityLogSchema = new Schema<IActivityLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Action cannot exceed 200 characters'],
    },
    entity: {
      type: String,
      trim: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
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

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1 });

// TTL index to auto-delete logs older than 90 days
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const ActivityLogModel = mongoose.model<IActivityLogDocument>(
  'ActivityLog',
  activityLogSchema
);

export default ActivityLogModel;
