import mongoose, { Schema } from 'mongoose';
import { IReminderDocument } from '../types';

const reminderSchema = new Schema<IReminderDocument>(
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
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      enum: ['Interview', 'Follow-up', 'Deadline', 'Custom'],
      required: [true, 'Reminder type is required'],
    },
    reminderDate: {
      type: Date,
      required: [true, 'Reminder date is required'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Sent', 'Dismissed'],
      default: 'Pending',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringInterval: {
      type: Number,
      min: [1, 'Interval must be at least 1'],
    },
    recurringUnit: {
      type: String,
      enum: ['days', 'weeks', 'months'],
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

reminderSchema.index({ userId: 1, reminderDate: 1 });
reminderSchema.index({ userId: 1, status: 1 });
reminderSchema.index({ reminderDate: 1, status: 1 });

const ReminderModel = mongoose.model<IReminderDocument>('Reminder', reminderSchema);

export default ReminderModel;
