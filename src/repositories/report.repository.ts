import { Types } from 'mongoose';
import { ReportModel } from '../models';
import { IReportDocument } from '../types';

export class ReportRepository {
  async create(data: {
    userId: string;
    type: 'monthly' | 'yearly' | 'custom';
    format: 'pdf' | 'csv';
    dateRange: { startDate: Date; endDate: Date };
    status: 'pending' | 'completed' | 'failed';
    fileUrl?: string;
    data?: Record<string, unknown>;
  }): Promise<IReportDocument> {
    return ReportModel.create({ ...data, userId: new Types.ObjectId(data.userId) });
  }

  async findByUserId(
    userId: string,
    skip = 0,
    limit = 10
  ): Promise<IReportDocument[]> {
    return ReportModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByUserId(userId: string): Promise<number> {
    return ReportModel.countDocuments({ userId: new Types.ObjectId(userId) });
  }

  async findById(id: string): Promise<IReportDocument | null> {
    return ReportModel.findById(id);
  }

  async update(
    id: string,
    data: Partial<IReportDocument>
  ): Promise<IReportDocument | null> {
    return ReportModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await ReportModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }
}

export const reportRepository = new ReportRepository();
