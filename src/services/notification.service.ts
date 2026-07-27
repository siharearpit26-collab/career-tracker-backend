import { notificationRepository } from '../repositories/notification.repository';
import { INotificationDocument, CreateNotificationDTO, PaginatedResult } from '../types';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { NotFoundError } from '../utils/errors';

export class NotificationService {
  async createNotification(
    data: CreateNotificationDTO
  ): Promise<INotificationDocument> {
    return notificationRepository.create(data);
  }

  async getNotifications(
    userId: string,
    filters: { isRead?: boolean; type?: string },
    page = 1,
    limit = 20
  ): Promise<PaginatedResult<INotificationDocument>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      notificationRepository.findByUserId(userId, filters, skip, limit),
      notificationRepository.countByUserId(userId, filters),
    ]);

    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.getUnreadCount(userId);
  }

  async markAsRead(
    id: string,
    userId: string
  ): Promise<INotificationDocument> {
    const notification = await notificationRepository.markAsRead(id, userId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const deleted = await notificationRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Notification not found');
    }
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await notificationRepository.deleteAll(userId);
  }
}

export const notificationService = new NotificationService();
