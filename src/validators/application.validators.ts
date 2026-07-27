import { z } from 'zod';

const interviewStageSchema = z.object({
  type: z.enum(['Phone Screen', 'Technical', 'HR', 'On-site', 'Final', 'Other']),
  date: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  outcome: z.enum(['Passed', 'Failed', 'Pending', 'Cancelled']).optional(),
});

// Accept any string for jobUrl — don't validate URL format strictly
const optionalUrl = z.string().optional().or(z.literal(''));

export const createApplicationSchema = z.object({
  company: z.string().min(1, 'Company is required').max(200).trim(),
  jobTitle: z.string().min(1, 'Job title is required').max(200).trim(),
  location: z.string().max(200).trim().optional(),
  appliedDate: z.coerce.date().optional(),
  source: z
    .enum(['LinkedIn', 'Indeed', 'Company Website', 'Referral', 'Job Fair', 'Recruiter', 'Other'])
    .optional(),
  status: z
    .enum([
      'Applied',
      'Shortlisted',
      'Interview Scheduled',
      'Interview Completed',
      'Offer',
      'Rejected',
      'Withdrawn',
    ])
    .optional()
    .default('Applied'),
  notes: z.string().max(5000).optional(),
  jobUrl: optionalUrl,
  resumeVersion: z.string().max(100).optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().max(3).optional().default('USD'),
  deadline: z.coerce.date().optional(),
  interviewStages: z.array(interviewStageSchema).optional().default([]),
});

export const updateApplicationSchema = z.object({
  company: z.string().min(1).max(200).trim().optional(),
  jobTitle: z.string().min(1).max(200).trim().optional(),
  location: z.string().max(200).trim().optional(),
  appliedDate: z.coerce.date().optional(),
  source: z
    .enum(['LinkedIn', 'Indeed', 'Company Website', 'Referral', 'Job Fair', 'Recruiter', 'Other'])
    .optional(),
  status: z
    .enum([
      'Applied',
      'Shortlisted',
      'Interview Scheduled',
      'Interview Completed',
      'Offer',
      'Rejected',
      'Withdrawn',
    ])
    .optional(),
  notes: z.string().max(5000).optional(),
  jobUrl: optionalUrl,
  resumeVersion: z.string().max(100).optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().max(3).optional(),
  deadline: z.coerce.date().optional(),
  interviewStages: z.array(interviewStageSchema).optional(),
  isArchived: z.boolean().optional(),
});

export const applicationFilterSchema = z.object({
  status: z
    .enum([
      'Applied',
      'Shortlisted',
      'Interview Scheduled',
      'Interview Completed',
      'Offer',
      'Rejected',
      'Withdrawn',
    ])
    .optional(),
  source: z
    .enum(['LinkedIn', 'Indeed', 'Company Website', 'Referral', 'Job Fair', 'Recruiter', 'Other'])
    .optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  isArchived: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z.string().optional().default('appliedDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const addInterviewStageSchema = z.object({
  type: z.enum(['Phone Screen', 'Technical', 'HR', 'On-site', 'Final', 'Other']),
  date: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  outcome: z.enum(['Passed', 'Failed', 'Pending', 'Cancelled']).optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ApplicationFilterInput = z.infer<typeof applicationFilterSchema>;
export type AddInterviewStageInput = z.infer<typeof addInterviewStageSchema>;
