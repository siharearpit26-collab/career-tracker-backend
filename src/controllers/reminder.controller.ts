import { Response, NextFunction } from 'express';
import { reminderService } from '../services/reminder.service';
import { AuthenticatedRequest } from '../types';

export class ReminderController {
  /**
   * @swagger
   * /reminders:
   *   post:
   *     tags: [Reminders]
   *     summary: Create a new reminder
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, type, reminderDate]
   *             properties:
   *               title:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [Interview, Follow-up, Deadline, Custom]
   *               reminderDate:
   *                 type: string
   *                 format: date-time
   *               description:
   *                 type: string
   *               applicationId:
   *                 type: string
   *               isRecurring:
   *                 type: boolean
   *               recurringInterval:
   *                 type: number
   *               recurringUnit:
   *                 type: string
   *                 enum: [days, weeks, months]
   *     responses:
   *       201:
   *         description: Reminder created
   */
  async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reminder = await reminderService.createReminder(
        req.userId!,
        req.body
      );
      res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders:
   *   get:
   *     tags: [Reminders]
   *     summary: Get all reminders with filters
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [Pending, Sent, Dismissed]
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *       - in: query
   *         name: upcoming
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
   *         description: Reminders retrieved
   */
  async getAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        status,
        type,
        upcoming,
        page = '1',
        limit = '10',
        sortBy = 'reminderDate',
        sortOrder = 'asc',
      } = req.query as Record<string, string>;

      const result = await reminderService.getReminders(
        req.userId!,
        {
          status,
          type,
          upcoming: upcoming === 'true',
        },
        parseInt(page, 10),
        parseInt(limit, 10),
        sortBy,
        sortOrder as 'asc' | 'desc'
      );

      res.status(200).json({
        success: true,
        message: 'Reminders retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders/upcoming:
   *   get:
   *     tags: [Reminders]
   *     summary: Get upcoming reminders
   *     responses:
   *       200:
   *         description: Upcoming reminders
   */
  async getUpcoming(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reminders = await reminderService.getUpcomingReminders(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Upcoming reminders retrieved successfully',
        data: reminders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders/{id}:
   *   get:
   *     tags: [Reminders]
   *     summary: Get reminder by ID
   */
  async getById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reminder = await reminderService.getReminderById(
        req.params['id']!,
        req.userId!
      );
      res.status(200).json({
        success: true,
        message: 'Reminder retrieved successfully',
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders/{id}:
   *   put:
   *     tags: [Reminders]
   *     summary: Update reminder
   */
  async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reminder = await reminderService.updateReminder(
        req.params['id']!,
        req.userId!,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Reminder updated successfully',
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders/{id}:
   *   delete:
   *     tags: [Reminders]
   *     summary: Delete reminder
   */
  async delete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await reminderService.deleteReminder(req.params['id']!, req.userId!);
      res.status(200).json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reminders/{id}/dismiss:
   *   patch:
   *     tags: [Reminders]
   *     summary: Dismiss a reminder
   */
  async dismiss(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reminder = await reminderService.dismissReminder(
        req.params['id']!,
        req.userId!
      );
      res.status(200).json({
        success: true,
        message: 'Reminder dismissed successfully',
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reminderController = new ReminderController();
