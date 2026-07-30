import { calendarRepository } from '../repositories/calendar.repository';
import { emailRepository } from '../repositories/email.repository';
import { decrypt } from '../utils/encryption.utils';
import { refreshGmailToken, refreshOutlookToken } from '../utils/oauth.utils';
import {
  ICalendarEventDocument,
  CreateCalendarEventDTO,
  CalendarProvider,
  PaginatedResult,
} from '../types';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { logger } from '../utils/logger';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
  hangoutLink?: string;
}

interface OutlookCalendarEvent {
  id: string;
  subject: string;
  body?: { content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  onlineMeeting?: { joinUrl: string };
}

export class CalendarService {
  // Create event and sync to external calendar
  async createEvent(
    userId: string,
    data: CreateCalendarEventDTO
  ): Promise<ICalendarEventDocument> {
    // Get user's connected email account to determine calendar provider
    const accounts = await emailRepository.findAccountsByUserId(userId);

    if (accounts.length === 0) {
      throw new BadRequestError(
        'No email account connected. Connect Gmail or Outlook first to sync calendar events.'
      );
    }

    const account = accounts[0]!;
    const provider: CalendarProvider = account.provider === 'gmail' ? 'google' : 'outlook';

    // Get valid access token
    const accountWithTokens = await emailRepository.findAccountByIdWithTokens(
      account._id.toString()
    );

    if (!accountWithTokens) {
      throw new BadRequestError('Email account tokens not found');
    }

    let accessToken = accountWithTokens.accessToken;

    if (new Date() >= accountWithTokens.tokenExpiresAt) {
      if (provider === 'google') {
        const refreshed = await refreshGmailToken(accountWithTokens.refreshToken);
        accessToken = refreshed.accessToken;
        await emailRepository.updateAccountTokens(account._id.toString(), {
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
      } else {
        const refreshed = await refreshOutlookToken(accountWithTokens.refreshToken);
        accessToken = refreshed.accessToken;
        await emailRepository.updateAccountTokens(account._id.toString(), {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
      }
    }

    const decryptedToken = decrypt(accessToken);

    // Create event on external calendar
    const externalEventId =
      provider === 'google'
        ? await this.createGoogleEvent(decryptedToken, data)
        : await this.createOutlookEvent(decryptedToken, data);

    // Save to local DB
    return calendarRepository.create({
      userId,
      applicationId: data.applicationId,
      reminderId: data.reminderId,
      provider,
      externalEventId,
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      location: data.location,
      meetingUrl: data.meetingUrl,
    });
  }

  // Get events for a user
  async getEvents(
    userId: string,
    filters: {
      startAfter?: string;
      startBefore?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResult<ICalendarEventDocument>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const dateFilters = {
      startAfter: filters.startAfter ? new Date(filters.startAfter) : undefined,
      startBefore: filters.startBefore ? new Date(filters.startBefore) : undefined,
    };

    const [data, total] = await Promise.all([
      calendarRepository.findByUserId(userId, dateFilters, skip, limit),
      calendarRepository.countByUserId(userId, dateFilters),
    ]);

    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy: 'startTime',
      sortOrder: 'asc',
    });
  }

  // Get upcoming events
  async getUpcoming(userId: string, limit = 5): Promise<ICalendarEventDocument[]> {
    return calendarRepository.getUpcoming(userId, limit);
  }

  // Get events for a specific application
  async getByApplication(
    applicationId: string,
    userId: string
  ): Promise<ICalendarEventDocument[]> {
    return calendarRepository.findByApplicationId(applicationId, userId);
  }

  // Delete event (also removes from external calendar)
  async deleteEvent(id: string, userId: string): Promise<void> {
    const event = await calendarRepository.findById(id, userId);
    if (!event) {
      throw new NotFoundError('Calendar event not found');
    }

    // Try to delete from external calendar (non-critical)
    try {
      const accounts = await emailRepository.findAccountsByUserId(userId);
      const account = accounts.find(
        (a) =>
          (a.provider === 'gmail' && event.provider === 'google') ||
          (a.provider === 'outlook' && event.provider === 'outlook')
      );

      if (account) {
        const accountWithTokens = await emailRepository.findAccountByIdWithTokens(
          account._id.toString()
        );

        if (accountWithTokens) {
          const decryptedToken = decrypt(accountWithTokens.accessToken);

          if (event.provider === 'google') {
            await this.deleteGoogleEvent(decryptedToken, event.externalEventId);
          } else {
            await this.deleteOutlookEvent(decryptedToken, event.externalEventId);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to delete external calendar event:', error);
    }

    await calendarRepository.delete(id, userId);
  }

  // Google Calendar API
  private async createGoogleEvent(
    accessToken: string,
    data: CreateCalendarEventDTO
  ): Promise<string> {
    const event = {
      summary: data.title,
      description: data.description,
      start: { dateTime: new Date(data.startTime).toISOString() },
      end: { dateTime: new Date(data.endTime).toISOString() },
      location: data.location,
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Google Calendar create failed:', error);
      throw new BadRequestError('Failed to create Google Calendar event');
    }

    const created = (await response.json()) as GoogleCalendarEvent;
    return created.id;
  }

  private async deleteGoogleEvent(
    accessToken: string,
    eventId: string
  ): Promise<void> {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }

  // Outlook Calendar API
  private async createOutlookEvent(
    accessToken: string,
    data: CreateCalendarEventDTO
  ): Promise<string> {
    const event = {
      subject: data.title,
      body: data.description
        ? { contentType: 'text', content: data.description }
        : undefined,
      start: {
        dateTime: new Date(data.startTime).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(data.endTime).toISOString(),
        timeZone: 'UTC',
      },
      location: data.location ? { displayName: data.location } : undefined,
    };

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Outlook Calendar create failed:', error);
      throw new BadRequestError('Failed to create Outlook Calendar event');
    }

    const created = (await response.json()) as OutlookCalendarEvent;
    return created.id;
  }

  private async deleteOutlookEvent(
    accessToken: string,
    eventId: string
  ): Promise<void> {
    await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }
}

export const calendarService = new CalendarService();
