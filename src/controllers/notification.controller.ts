import { Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';

export class NotificationController {
  /**
   * @swagger
   * /notifications:
   *   get:
   *     tags: [Notifications]
   *     summary: Get all notifications
   *     parameters:
   *       - in: query
   *         name: isRead
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Notifications retrieved
   */
  async getAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        isRead,
        type,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const result = await notificationService.getNotifications(
        req.userId!,
        {
          isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
          type,
        },
        parseInt(page, 10),
        parseInt(limit, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/unread-count:
   *   get:
   *     tags: [Notifications]
   *     summary: Get unread notification count
   *     responses:
   *       200:
   *         description: Unread count
   */
  async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/{id}/read:
   *   patch:
   *     tags: [Notifications]
   *     summary: Mark notification as read
   */
  async markAsRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const notification = await notificationService.markAsRead(
        req.params['id']!,
        req.userId!
      );
      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/read-all:
   *   patch:
   *     tags: [Notifications]
   *     summary: Mark all notifications as read
   */
  async markAllAsRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.userId!);
      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/{id}:
   *   delete:
   *     tags: [Notifications]
   *     summary: Delete a notification
   */
  async delete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await notificationService.deleteNotification(
        req.params['id']!,
        req.userId!
      );
      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications:
   *   delete:
   *     tags: [Notifications]
   *     summary: Delete all notifications
   */
  async deleteAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await notificationService.deleteAllNotifications(req.userId!);
      res.status(200).json({
        success: true,
        message: 'All notifications deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
