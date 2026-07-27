import { Document, Types } from 'mongoose';

export type NotificationType =
  | 'interview_reminder'
  | 'follow_up_alert'
  | 'deadline_alert'
  | 'application_update'
  | 'system';

export interface INotification {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  applicationId?: Types.ObjectId;
  reminderId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
}

export interface CreateNotificationDTO {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  applicationId?: string;
  reminderId?: string;
  metadata?: Record<string, unknown>;
}
