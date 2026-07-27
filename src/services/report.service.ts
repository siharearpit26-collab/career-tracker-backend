import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { applicationRepository } from '../repositories/application.repository';
import { reportRepository } from '../repositories/report.repository';
import { userRepository } from '../repositories/user.repository';
import { generatePDFReport } from '../utils/pdf.utils';
import { generateCSVReport } from '../utils/csv.utils';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { NotFoundError } from '../utils/errors';
import { IReportDocument, PaginatedResult } from '../types';

interface ReportOptions {
  format: 'pdf' | 'csv';
  dateRange: { startDate: Date; endDate: Date };
  type: 'monthly' | 'yearly' | 'custom';
}

export class ReportService {
  private async buildReportData(userId: string, dateRange: { startDate: Date; endDate: Date }) {
    const user = await userRepository.findById(userId);
    const userName = user
      ? `${user.firstName} ${user.lastName}`
      : 'User';

    const { data: applications } = await applicationRepository.findByUserId(
      userId,
      { dateFrom: dateRange.startDate, dateTo: dateRange.endDate },
      { page: 1, limit: 1000, sortBy: 'appliedDate', sortOrder: 'desc' }
    );

    const [byStatus, bySource] = await Promise.all([
      applicationRepository.countByStatus(userId),
      applicationRepository.countBySource(userId),
    ]);

    const total = applications.length;
    const responded = total - (byStatus['Applied'] ?? 0);
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

    const interviews =
      (byStatus['Interview Scheduled'] ?? 0) +
      (byStatus['Interview Completed'] ?? 0);
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

    const offers = byStatus['Offer'] ?? 0;
    const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0;

    return {
      userName,
      dateRange,
      totalApplications: total,
      byStatus,
      bySource,
      responseRate,
      interviewRate,
      offerRate,
      applications,
    };
  }

  async generateReport(
    userId: string,
    options: ReportOptions
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const reportData = await this.buildReportData(userId, options.dateRange);

    // Save report record
    await reportRepository.create({
      userId,
      type: options.type,
      format: options.format,
      dateRange: options.dateRange,
      status: 'completed',
      data: {
        totalApplications: reportData.totalApplications,
        responseRate: reportData.responseRate,
        offerRate: reportData.offerRate,
        interviewRate: reportData.interviewRate,
      },
    });

    if (options.format === 'pdf') {
      const buffer = generatePDFReport(reportData);
      return {
        buffer,
        mimeType: 'application/pdf',
        filename: `careertracker-report-${Date.now()}.pdf`,
      };
    } else {
      const csv = generateCSVReport(reportData.applications);
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        mimeType: 'text/csv',
        filename: `careertracker-report-${Date.now()}.csv`,
      };
    }
  }

  async generateMonthlyReport(
    userId: string,
    format: 'pdf' | 'csv',
    month?: number,
    year?: number
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();
    const date = new Date(targetYear, targetMonth - 1, 1);

    return this.generateReport(userId, {
      format,
      type: 'monthly',
      dateRange: {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
      },
    });
  }

  async generateYearlyReport(
    userId: string,
    format: 'pdf' | 'csv',
    year?: number
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const targetYear = year ?? new Date().getFullYear();
    const date = new Date(targetYear, 0, 1);

    return this.generateReport(userId, {
      format,
      type: 'yearly',
      dateRange: {
        startDate: startOfYear(date),
        endDate: endOfYear(date),
      },
    });
  }

  async getReportHistory(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedResult<IReportDocument>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      reportRepository.findByUserId(userId, skip, limit),
      reportRepository.countByUserId(userId),
    ]);
    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async deleteReport(id: string, userId: string): Promise<void> {
    const report = await reportRepository.findById(id);
    if (!report) throw new NotFoundError('Report not found');
    await reportRepository.delete(id, userId);
  }
}

export const reportService = new ReportService();
