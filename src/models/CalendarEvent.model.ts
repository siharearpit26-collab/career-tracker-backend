import mongoose, { Schema } from 'mongoose';
import { ICalendarEventDocument } from '../types';

const calendarEventSchema = new Schema<ICalendarEventDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
    },
    reminderId: {
      type: Schema.Types.ObjectId,
      ref: 'Reminder',
    },
    provider: {
      type: String,
      enum: ['google', 'outlook'],
      required: true,
    },
    externalEventId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: [300, 'Location cannot exceed 300 characters'],
    },
    meetingUrl: {
      type: String,
      trim: true,
    },
    isSynced: {
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
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

calendarEventSchema.index({ userId: 1, startTime: 1 });
calendarEventSchema.index({ userId: 1, applicationId: 1 });
calendarEventSchema.index({ externalEventId: 1, provider: 1 }, { unique: true });

const CalendarEventModel = mongoose.model<ICalendarEventDocument>(
  'CalendarEvent',
  calendarEventSchema
);

export default CalendarEventModel;
