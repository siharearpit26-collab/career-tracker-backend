import mongoose, { Schema } from 'mongoose';
import { IReportDocument } from '../types';

const reportSchema = new Schema<IReportDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['monthly', 'yearly', 'custom'],
      required: true,
    },
    format: {
      type: String,
      enum: ['pdf', 'csv'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    dateRange: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    fileUrl: { type: String },
    data: { type: Schema.Types.Mixed },
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

reportSchema.index({ userId: 1, createdAt: -1 });

const ReportModel = mongoose.model<IReportDocument>('Report', reportSchema);

export default ReportModel;
