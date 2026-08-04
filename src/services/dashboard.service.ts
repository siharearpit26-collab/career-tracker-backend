import { Types } from 'mongoose';
import { ApplicationModel } from '../models';
import { applicationRepository } from '../repositories/application.repository';
import { getCache, setCache } from '../database/redis';

const CACHE_TTL = 300; // 5 minutes

export class DashboardService {
  async getStats(userId: string): Promise<{
    totalApplications: number;
    totalInterviews: number;
    totalOffers: number;
    totalRejected: number;
    totalPending: number;
    responseRate: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const cacheKey = `dashboard:stats:${userId}`;
    const cached = await getCache<ReturnType<DashboardService['getStats']>>(cacheKey);
    if (cached) return cached;

    const [byStatus, bySource] = await Promise.all([
      applicationRepository.countByStatus(userId),
      applicationRepository.countBySource(userId),
    ]);

    const totalApplications = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const totalInterviews =
      (byStatus['Interview Scheduled'] ?? 0) +
      (byStatus['Interview Completed'] ?? 0);
    const totalOffers = byStatus['Offer'] ?? 0;
    const totalRejected = byStatus['Rejected'] ?? 0;
    const totalPending =
      (byStatus['Applied'] ?? 0) + (byStatus['Shortlisted'] ?? 0);

    const responded =
      totalApplications - (byStatus['Applied'] ?? 0);
    const responseRate =
      totalApplications > 0
        ? Math.round((responded / totalApplications) * 100)
        : 0;

    const result = {
      totalApplications,
      totalInterviews,
      totalOffers,
      totalRejected,
      totalPending,
      responseRate,
      interviewRate: totalApplications > 0 ? Math.round((totalInterviews / totalApplications) * 100) : 0,
      offerRate: totalApplications > 0 ? Math.round((totalOffers / totalApplications) * 100) : 0,
      byStatus,
      bySource,
    };

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  }

  async getMonthlyStats(
    userId: string,
    year?: number
  ): Promise<Array<{ month: number; monthName: string; count: number }>> {
    const targetYear = year ?? new Date().getFullYear();
    const cacheKey = `dashboard:monthly:${userId}:${targetYear}`;
    const cached =
      await getCache<Array<{ month: number; monthName: string; count: number }>>(cacheKey);
    if (cached) return cached;

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const rawStats = await applicationRepository.getMonthlyStats(userId, targetYear);

    // Fill all 12 months, even those with 0 applications
    const result = Array.from({ length: 12 }, (_, i) => {
      const found = rawStats.find((s) => s.month === i + 1);
      return {
        month: i + 1,
        monthName: monthNames[i] ?? '',
        count: found?.count ?? 0,
      };
    });

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  }

  async getWeeklyStats(userId: string): Promise<
    Array<{ date: string; count: number }>
  > {
    const cacheKey = `dashboard:weekly:${userId}`;
    const cached = await getCache<Array<{ date: string; count: number }>>(cacheKey);
    if (cached) return cached;

    // Single aggregation instead of 7 sequential queries
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const result = await ApplicationModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          appliedDate: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$appliedDate' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build a full 7-day array including days with 0 applications
    const countByDate: Record<string, number> = {};
    result.forEach((r: { _id: string; count: number }) => {
      countByDate[r._id] = r.count;
    });

    const days: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0] ?? '';
      days.push({ date: dateStr, count: countByDate[dateStr] ?? 0 });
    }

    await setCache(cacheKey, days, CACHE_TTL);
    return days;
  }

  async getTimeline(
    userId: string,
    limit = 10
  ): Promise<
    Array<{
      id: string;
      company: string;
      jobTitle: string;
      status: string;
      appliedDate: Date;
    }>
  > {
    const recent = await applicationRepository.getRecentApplications(userId, limit);
    return recent.map((app) => ({
      id: app._id.toString(),
      company: app.company,
      jobTitle: app.jobTitle,
      status: app.status,
      appliedDate: app.appliedDate,
    }));
  }

  async getCompanyAnalytics(userId: string): Promise<
    Array<{ company: string; count: number; statuses: Record<string, number> }>
  > {
    const cacheKey = `dashboard:companies:${userId}`;
    const cached =
      await getCache<
        Array<{ company: string; count: number; statuses: Record<string, number> }>
      >(cacheKey);
    if (cached) return cached;

    const result = await ApplicationModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          isArchived: false,
        },
      },
      {
        $group: {
          _id: '$company',
          count: { $sum: 1 },
          statuses: { $push: '$status' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const analytics = result.map(
      (item: { _id: string; count: number; statuses: string[] }) => {
        const statusCounts: Record<string, number> = {};
        item.statuses.forEach((s: string) => {
          statusCounts[s] = (statusCounts[s] ?? 0) + 1;
        });
        return {
          company: item._id,
          count: item.count,
          statuses: statusCounts,
        };
      }
    );

    await setCache(cacheKey, analytics, CACHE_TTL);
    return analytics;
  }

  async getSummary(userId: string): Promise<{
    stats: Awaited<ReturnType<DashboardService['getStats']>>;
    monthly: Awaited<ReturnType<DashboardService['getMonthlyStats']>>;
    weekly: Awaited<ReturnType<DashboardService['getWeeklyStats']>>;
    timeline: Awaited<ReturnType<DashboardService['getTimeline']>>;
    companies: Awaited<ReturnType<DashboardService['getCompanyAnalytics']>>;
  }> {
    const [stats, monthly, weekly, timeline, companies] = await Promise.all([
      this.getStats(userId),
      this.getMonthlyStats(userId),
      this.getWeeklyStats(userId),
      this.getTimeline(userId),
      this.getCompanyAnalytics(userId),
    ]);

    return { stats, monthly, weekly, timeline, companies };
  }
}

export const dashboardService = new DashboardService();
