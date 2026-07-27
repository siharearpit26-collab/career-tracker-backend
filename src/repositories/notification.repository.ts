import { Types } from 'mongoose';
import { NotificationModel } from '../models';
import { INotificationDocument, CreateNotificationDTO } from '../types';

export class NotificationRepository {
  async create(data: CreateNotificationDTO): Promise<INotificationDocument> {
    return NotificationModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId),
    });
  }

  async findByUserId(
    userId: string,
    filters: { isRead?: boolean; type?: string },
    skip = 0,
    limit = 20
  ): Promise<INotificationDocument[]> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.isRead !== undefined) query['isRead'] = filters.isRead;
    if (filters.type) query['type'] = filters.type;

    return NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByUserId(
    userId: string,
    filters: { isRead?: boolean }
  ): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.isRead !== undefined) query['isRead'] = filters.isRead;
    return NotificationModel.countDocuments(query);
  }

  async markAsRead(id: string, userId: string): Promise<INotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { isRead: true } },
      { new: true }
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } }
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await NotificationModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  async deleteAll(userId: string): Promise<void> {
    await NotificationModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}

export const notificationRepository = new NotificationRepository();
