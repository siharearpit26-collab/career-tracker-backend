import { Response, NextFunction } from 'express';
import { calendarService } from '../services/calendar.service';
import { AuthenticatedRequest, CreateCalendarEventDTO } from '../types';

export class CalendarController {
  async createEvent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as CreateCalendarEventDTO;
      const event = await calendarService.createEvent(req.userId!, data);

      res.status(201).json({
        success: true,
        message: 'Calendar event created and synced',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvents(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        startAfter,
        startBefore,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const result = await calendarService.getEvents(req.userId!, {
        startAfter,
        startBefore,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      res.status(200).json({
        success: true,
        message: 'Calendar events retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit = '5' } = req.query as Record<string, string>;
      const events = await calendarService.getUpcoming(
        req.userId!,
        parseInt(limit, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Upcoming events retrieved',
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByApplication(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const events = await calendarService.getByApplication(
        req.params['applicationId']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Application events retrieved',
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await calendarService.deleteEvent(req.params['id']!, req.userId!);

      res.status(200).json({
        success: true,
        message: 'Calendar event deleted',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
