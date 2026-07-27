import { Types } from 'mongoose';
import { ReminderModel } from '../models';
import { IReminderDocument, CreateReminderDTO, UpdateReminderDTO } from '../types';
import { calculateSkip } from '../utils/pagination.utils';

export class ReminderRepository {
  async create(
    userId: string,
    data: CreateReminderDTO
  ): Promise<IReminderDocument> {
    return ReminderModel.create({ ...data, userId: new Types.ObjectId(userId) });
  }

  async findById(id: string): Promise<IReminderDocument | null> {
    return ReminderModel.findById(id);
  }

  async findByIdAndUserId(
    id: string,
    userId: string
  ): Promise<IReminderDocument | null> {
    return ReminderModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
  }

  async findByUserId(
    userId: string,
    filters: {
      status?: string;
      type?: string;
      upcoming?: boolean;
    },
    skip = 0,
    limit = 10,
    sortBy = 'reminderDate',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<IReminderDocument[]> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.status) query['status'] = filters.status;
    if (filters.type) query['type'] = filters.type;
    if (filters.upcoming) {
      query['reminderDate'] = { $gte: new Date() };
      query['status'] = 'Pending';
    }

    return ReminderModel.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate('applicationId', 'company jobTitle status');
  }

  async countByUserId(
    userId: string,
    filters: { status?: string; type?: string }
  ): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.status) query['status'] = filters.status;
    if (filters.type) query['type'] = filters.type;
    return ReminderModel.countDocuments(query);
  }

  async update(
    id: string,
    userId: string,
    data: UpdateReminderDTO
  ): Promise<IReminderDocument | null> {
    return ReminderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await ReminderModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  async findDueReminders(): Promise<IReminderDocument[]> {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    return ReminderModel.find({
      status: 'Pending',
      reminderDate: { $gte: now, $lte: fiveMinutesFromNow },
    }).populate('userId', 'email firstName lastName preferences');
  }

  async markAsSent(id: string): Promise<void> {
    await ReminderModel.findByIdAndUpdate(id, {
      $set: { status: 'Sent' },
    });
  }

  async dismiss(id: string, userId: string): Promise<IReminderDocument | null> {
    return ReminderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { status: 'Dismissed' } },
      { new: true }
    );
  }

  async getUpcomingCount(userId: string): Promise<number> {
    return ReminderModel.countDocuments({
      userId: new Types.ObjectId(userId),
      status: 'Pending',
      reminderDate: { $gte: new Date() },
    });
  }
}

export const reminderRepository = new ReminderRepository();
