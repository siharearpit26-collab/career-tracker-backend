import { z } from 'zod';

export const generateReportSchema = z.object({
  type: z.enum(['monthly', 'yearly', 'custom']),
  format: z.enum(['pdf', 'csv']),
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
}).refine(
  (data) => data.dateRange.startDate <= data.dateRange.endDate,
  { message: 'Start date must be before end date', path: ['dateRange'] }
);

export const monthlyReportSchema = z.object({
  format: z.enum(['pdf', 'csv']).default('pdf'),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
});

export const yearlyReportSchema = z.object({
  format: z.enum(['pdf', 'csv']).default('pdf'),
  year: z.coerce.number().min(2000).max(2100).optional(),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type YearlyReportInput = z.infer<typeof yearlyReportSchema>;
