import { Types } from 'mongoose';
import { ApplicationModel } from '../models';
import {
  IApplicationDocument,
  CreateApplicationDTO,
  UpdateApplicationDTO,
  ApplicationFilterOptions,
  PaginationOptions,
} from '../types';
import { calculateSkip } from '../utils/pagination.utils';

export class ApplicationRepository {
  async create(
    userId: string,
    data: CreateApplicationDTO
  ): Promise<IApplicationDocument> {
    return ApplicationModel.create({ ...data, userId: new Types.ObjectId(userId) });
  }

  async findById(id: string): Promise<IApplicationDocument | null> {
    return ApplicationModel.findById(id);
  }

  async findByIdAndUserId(
    id: string,
    userId: string
  ): Promise<IApplicationDocument | null> {
    return ApplicationModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateApplicationDTO
  ): Promise<IApplicationDocument | null> {
    return ApplicationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      return false;
    }
    const result = await ApplicationModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  async findByUserId(
    userId: string,
    filters: ApplicationFilterOptions,
    pagination: PaginationOptions
  ): Promise<{ data: IApplicationDocument[]; total: number }> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    // Apply filters
    if (filters.status) query['status'] = filters.status;
    if (filters.source) query['source'] = filters.source;
    if (filters.isArchived !== undefined) query['isArchived'] = filters.isArchived;

    if (filters.company) {
      query['company'] = { $regex: filters.company, $options: 'i' };
    }

    if (filters.location) {
      query['location'] = { $regex: filters.location, $options: 'i' };
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (filters.dateFrom) dateFilter['$gte'] = filters.dateFrom;
      if (filters.dateTo) dateFilter['$lte'] = filters.dateTo;
      query['appliedDate'] = dateFilter;
    }

    if (filters.salaryMin !== undefined || filters.salaryMax !== undefined) {
      const salaryFilter: Record<string, number> = {};
      if (filters.salaryMin !== undefined) salaryFilter['$gte'] = filters.salaryMin;
      if (filters.salaryMax !== undefined) salaryFilter['$lte'] = filters.salaryMax;
      query['salaryMin'] = salaryFilter;
    }

    // Text search across company, jobTitle, location
    if (filters.search) {
      query['$or'] = [
        { company: { $regex: filters.search, $options: 'i' } },
        { jobTitle: { $regex: filters.search, $options: 'i' } },
        { location: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const skip = calculateSkip(pagination.page, pagination.limit);
    const sortField = pagination.sortBy ?? 'appliedDate';
    const sortDirection = pagination.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      ApplicationModel.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(pagination.limit),
      ApplicationModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async countByStatus(
    userId: string
  ): Promise<Record<string, number>> {
    const result = await ApplicationModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId), isArchived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    result.forEach((item: { _id: string; count: number }) => {
      counts[item._id] = item.count;
    });
    return counts;
  }

  async countBySource(userId: string): Promise<Record<string, number>> {
    const result = await ApplicationModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          isArchived: false,
          source: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    result.forEach((item: { _id: string; count: number }) => {
      counts[item._id] = item.count;
    });
    return counts;
  }

  async getMonthlyStats(
    userId: string,
    year: number
  ): Promise<Array<{ month: number; count: number }>> {
    return ApplicationModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          appliedDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: '$appliedDate' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } },
    ]);
  }

  async getTotalCount(userId: string, isArchived = false): Promise<number> {
    return ApplicationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isArchived,
    });
  }

  async getRecentApplications(
    userId: string,
    limit = 5
  ): Promise<IApplicationDocument[]> {
    return ApplicationModel.find({
      userId: new Types.ObjectId(userId),
      isArchived: false,
    })
      .sort({ appliedDate: -1 })
      .limit(limit);
  }
}

export const applicationRepository = new ApplicationRepository();
