import { Types, Document } from 'mongoose';

export type CalendarProvider = 'google' | 'outlook';

export interface ICalendarEvent {
  userId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  reminderId?: Types.ObjectId;
  provider: CalendarProvider;
  externalEventId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  meetingUrl?: string;
  isSynced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICalendarEventDocument extends ICalendarEvent, Document {
  _id: Types.ObjectId;
}

export interface CreateCalendarEventDTO {
  applicationId?: string;
  reminderId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingUrl?: string;
}

export interface CalendarEventResponse {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingUrl?: string;
  provider: CalendarProvider;
  applicationId?: string;
  reminderId?: string;
  isSynced: boolean;
  externalEventId: string;
}
