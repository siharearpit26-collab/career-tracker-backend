import { z } from 'zod';

export const createReminderSchema = z.object({
  applicationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid application ID')
    .optional(),
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).optional(),
  type: z.enum(['Interview', 'Follow-up', 'Deadline', 'Custom']),
  reminderDate: z.coerce.date().refine(
    (date) => date > new Date(),
    'Reminder date must be in the future'
  ),
  isRecurring: z.boolean().optional().default(false),
  recurringInterval: z.number().min(1).optional(),
  recurringUnit: z.enum(['days', 'weeks', 'months']).optional(),
}).refine(
  (data) => {
    if (data.isRecurring) {
      return data.recurringInterval !== undefined && data.recurringUnit !== undefined;
    }
    return true;
  },
  {
    message: 'Recurring interval and unit are required for recurring reminders',
    path: ['recurringInterval'],
  }
);

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['Interview', 'Follow-up', 'Deadline', 'Custom']).optional(),
  reminderDate: z.coerce.date().optional(),
  status: z.enum(['Pending', 'Sent', 'Dismissed']).optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.number().min(1).optional(),
  recurringUnit: z.enum(['days', 'weeks', 'months']).optional(),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
