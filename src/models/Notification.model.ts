import mongoose, { Schema } from 'mongoose';
import { INotificationDocument } from '../types';

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      enum: [
        'interview_reminder',
        'follow_up_alert',
        'deadline_alert',
        'application_update',
        'system',
      ],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
    },
    reminderId: {
      type: Schema.Types.ObjectId,
      ref: 'Reminder',
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret['id'] = ret['_id'];
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const NotificationModel = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema
);

export default NotificationModel;
