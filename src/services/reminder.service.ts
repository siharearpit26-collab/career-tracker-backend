import { reminderRepository } from '../repositories/reminder.repository';
import { notificationService } from './notification.service';
import {
  IReminderDocument,
  CreateReminderDTO,
  UpdateReminderDTO,
  PaginatedResult,
} from '../types';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Types } from 'mongoose';

export class ReminderService {
  async createReminder(
    userId: string,
    data: CreateReminderDTO
  ): Promise<IReminderDocument> {
    if (!Types.ObjectId.isValid && data.applicationId) {
      throw new BadRequestError('Invalid application ID');
    }
    return reminderRepository.create(userId, data);
  }

  async getReminders(
    userId: string,
    filters: { status?: string; type?: string; upcoming?: boolean },
    page = 1,
    limit = 10,
    sortBy = 'reminderDate',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<IReminderDocument>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      reminderRepository.findByUserId(
        userId,
        filters,
        skip,
        limit,
        sortBy,
        sortOrder
      ),
      reminderRepository.countByUserId(userId, filters),
    ]);

    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  async getReminderById(
    id: string,
    userId: string
  ): Promise<IReminderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reminder ID');
    }
    const reminder = await reminderRepository.findByIdAndUserId(id, userId);
    if (!reminder) {
      throw new NotFoundError('Reminder not found');
    }
    return reminder;
  }

  async updateReminder(
    id: string,
    userId: string,
    data: UpdateReminderDTO
  ): Promise<IReminderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reminder ID');
    }
    const reminder = await reminderRepository.update(id, userId, data);
    if (!reminder) {
      throw new NotFoundError('Reminder not found');
    }
    return reminder;
  }

  async deleteReminder(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reminder ID');
    }
    const existing = await reminderRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      throw new NotFoundError('Reminder not found');
    }
    await reminderRepository.delete(id, userId);
  }

  async dismissReminder(
    id: string,
    userId: string
  ): Promise<IReminderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reminder ID');
    }
    const reminder = await reminderRepository.dismiss(id, userId);
    if (!reminder) {
      throw new NotFoundError('Reminder not found');
    }
    return reminder;
  }

  async getUpcomingReminders(userId: string): Promise<IReminderDocument[]> {
    const result = await reminderRepository.findByUserId(
      userId,
      { upcoming: true },
      0,
      10,
      'reminderDate',
      'asc'
    );
    return result;
  }

  async getUpcomingCount(userId: string): Promise<number> {
    return reminderRepository.getUpcomingCount(userId);
  }

  // Called by background job to process due reminders
  async processDueReminders(): Promise<void> {
    const dueReminders = await reminderRepository.findDueReminders();

    for (const reminder of dueReminders) {
      try {
        // Create in-app notification
        await notificationService.createNotification({
          userId: reminder.userId.toString(),
          title: `Reminder: ${reminder.title}`,
          message: reminder.description ?? `You have a ${reminder.type} reminder due now.`,
          type: reminder.type === 'Interview'
            ? 'interview_reminder'
            : reminder.type === 'Follow-up'
            ? 'follow_up_alert'
            : reminder.type === 'Deadline'
            ? 'deadline_alert'
            : 'system',
          reminderId: reminder._id.toString(),
          applicationId: reminder.applicationId?.toString(),
        });

        // Mark as sent
        await reminderRepository.markAsSent(reminder._id.toString());
      } catch {
        // Log but continue processing other reminders
      }
    }
  }
}

export const reminderService = new ReminderService();
