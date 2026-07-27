import { Document, Types } from 'mongoose';

export type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview Scheduled'
  | 'Interview Completed'
  | 'Offer'
  | 'Rejected'
  | 'Withdrawn';

export type ApplicationSource =
  | 'LinkedIn'
  | 'Indeed'
  | 'Company Website'
  | 'Referral'
  | 'Job Fair'
  | 'Recruiter'
  | 'Other';

export interface InterviewStage {
  type: 'Phone Screen' | 'Technical' | 'HR' | 'On-site' | 'Final' | 'Other';
  date?: Date;
  notes?: string;
  outcome?: 'Passed' | 'Failed' | 'Pending' | 'Cancelled';
}

export interface IApplication {
  userId: Types.ObjectId;
  company: string;
  jobTitle: string;
  location?: string;
  appliedDate: Date;
  source?: ApplicationSource;
  status: ApplicationStatus;
  notes?: string;
  jobUrl?: string;
  resumeVersion?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  deadline?: Date;
  interviewStages: InterviewStage[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplicationDocument extends IApplication, Document {
  _id: Types.ObjectId;
}

export interface CreateApplicationDTO {
  company: string;
  jobTitle: string;
  location?: string;
  appliedDate?: Date;
  source?: ApplicationSource;
  status?: ApplicationStatus;
  notes?: string;
  jobUrl?: string;
  resumeVersion?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  deadline?: Date;
  interviewStages?: InterviewStage[];
}

export interface UpdateApplicationDTO {
  company?: string;
  jobTitle?: string;
  location?: string;
  appliedDate?: Date;
  source?: ApplicationSource;
  status?: ApplicationStatus;
  notes?: string;
  jobUrl?: string;
  resumeVersion?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  deadline?: Date;
  interviewStages?: InterviewStage[];
  isArchived?: boolean;
}

export interface ApplicationFilterOptions {
  status?: ApplicationStatus;
  source?: ApplicationSource;
  company?: string;
  location?: string;
  dateFrom?: Date;
  dateTo?: Date;
  salaryMin?: number;
  salaryMax?: number;
  search?: string;
  isArchived?: boolean;
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  thisMonth: number;
  thisWeek: number;
  responseRate: number;
  offerRate: number;
  interviewRate: number;
}
