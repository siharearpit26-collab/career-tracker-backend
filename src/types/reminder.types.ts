import { Document, Types } from 'mongoose';

export type ReminderType = 'Interview' | 'Follow-up' | 'Deadline' | 'Custom';
export type ReminderStatus = 'Pending' | 'Sent' | 'Dismissed';

export interface IReminder {
  userId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  title: string;
  description?: string;
  type: ReminderType;
  reminderDate: Date;
  status: ReminderStatus;
  isRecurring: boolean;
  recurringInterval?: number;
  recurringUnit?: 'days' | 'weeks' | 'months';
  createdAt: Date;
  updatedAt: Date;
}

export interface IReminderDocument extends IReminder, Document {
  _id: Types.ObjectId;
}

export interface CreateReminderDTO {
  applicationId?: string;
  title: string;
  description?: string;
  type: ReminderType;
  reminderDate: Date;
  isRecurring?: boolean;
  recurringInterval?: number;
  recurringUnit?: 'days' | 'weeks' | 'months';
}

export interface UpdateReminderDTO extends Partial<CreateReminderDTO> {
  status?: ReminderStatus;
}
