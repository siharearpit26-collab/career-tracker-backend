import { z } from 'zod';

export const createCalendarEventSchema = z.object({
  applicationId: z.string().optional(),
  reminderId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(2000).optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start time'),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end time'),
  location: z.string().max(300).optional(),
  meetingUrl: z.string().url().optional().or(z.literal('')),
});

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
