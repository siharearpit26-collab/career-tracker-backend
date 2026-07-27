import { Document, Types } from 'mongoose';

export type ReportType = 'monthly' | 'yearly' | 'custom';
export type ReportFormat = 'pdf' | 'csv';
export type ReportStatus = 'pending' | 'completed' | 'failed';

export interface IReport {
  userId: Types.ObjectId;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  fileUrl?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReportDocument extends IReport, Document {
  _id: Types.ObjectId;
}

export interface GenerateReportDTO {
  type: ReportType;
  format: ReportFormat;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ReportData {
  totalApplications: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
  responseRate: number;
  offerRate: number;
  interviewRate: number;
  topCompanies: Array<{ company: string; count: number }>;
}
