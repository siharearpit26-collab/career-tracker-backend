import { Types } from 'mongoose';
import CalendarEventModel from '../models/CalendarEvent.model';
import { ICalendarEventDocument } from '../types';

export class CalendarRepository {
  async create(data: {
    userId: string;
    applicationId?: string;
    reminderId?: string;
    provider: 'google' | 'outlook';
    externalEventId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    meetingUrl?: string;
  }): Promise<ICalendarEventDocument> {
    return CalendarEventModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId),
      applicationId: data.applicationId
        ? new Types.ObjectId(data.applicationId)
        : undefined,
      reminderId: data.reminderId
        ? new Types.ObjectId(data.reminderId)
        : undefined,
    });
  }

  async findByUserId(
    userId: string,
    filters: { startAfter?: Date; startBefore?: Date },
    skip = 0,
    limit = 20
  ): Promise<ICalendarEventDocument[]> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.startAfter || filters.startBefore) {
      const startTimeFilter: Record<string, Date> = {};
      if (filters.startAfter) startTimeFilter['$gte'] = filters.startAfter;
      if (filters.startBefore) startTimeFilter['$lte'] = filters.startBefore;
      query['startTime'] = startTimeFilter;
    }

    return CalendarEventModel.find(query)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit)
      .populate('applicationId', 'company jobTitle status');
  }

  async countByUserId(
    userId: string,
    filters: { startAfter?: Date; startBefore?: Date }
  ): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.startAfter || filters.startBefore) {
      const startTimeFilter: Record<string, Date> = {};
      if (filters.startAfter) startTimeFilter['$gte'] = filters.startAfter;
      if (filters.startBefore) startTimeFilter['$lte'] = filters.startBefore;
      query['startTime'] = startTimeFilter;
    }

    return CalendarEventModel.countDocuments(query);
  }

  async findById(
    id: string,
    userId: string
  ): Promise<ICalendarEventDocument | null> {
    return CalendarEventModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).populate('applicationId', 'company jobTitle status');
  }

  async findByExternalId(
    externalEventId: string,
    provider: 'google' | 'outlook'
  ): Promise<ICalendarEventDocument | null> {
    return CalendarEventModel.findOne({ externalEventId, provider });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      location: string;
      meetingUrl: string;
      isSynced: boolean;
    }>
  ): Promise<ICalendarEventDocument | null> {
    return CalendarEventModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true }
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await CalendarEventModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  async getUpcoming(
    userId: string,
    limit = 5
  ): Promise<ICalendarEventDocument[]> {
    return CalendarEventModel.find({
      userId: new Types.ObjectId(userId),
      startTime: { $gte: new Date() },
    })
      .sort({ startTime: 1 })
      .limit(limit)
      .populate('applicationId', 'company jobTitle status');
  }

  async findByApplicationId(
    applicationId: string,
    userId: string
  ): Promise<ICalendarEventDocument[]> {
    return CalendarEventModel.find({
      applicationId: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    }).sort({ startTime: 1 });
  }
}

export const calendarRepository = new CalendarRepository();
