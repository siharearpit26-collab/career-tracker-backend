import { Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../types';

export class DashboardController {
  /**
   * @swagger
   * /dashboard/summary:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get complete dashboard summary (stats + monthly + weekly + timeline + companies)
   *     responses:
   *       200:
   *         description: Dashboard summary retrieved successfully
   */
  async getSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const summary = await dashboardService.getSummary(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /dashboard/stats:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get application statistics
   *     responses:
   *       200:
   *         description: Stats retrieved successfully
   */
  async getStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await dashboardService.getStats(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /dashboard/monthly:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get monthly application statistics
   *     parameters:
   *       - in: query
   *         name: year
   *         schema:
   *           type: integer
   *         description: Year (defaults to current year)
   *     responses:
   *       200:
   *         description: Monthly stats retrieved successfully
   */
  async getMonthlyStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { year } = req.query as { year?: string };
      const stats = await dashboardService.getMonthlyStats(
        req.userId!,
        year ? parseInt(year, 10) : undefined
      );
      res.status(200).json({
        success: true,
        message: 'Monthly stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /dashboard/weekly:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get last 7 days application activity
   *     responses:
   *       200:
   *         description: Weekly stats retrieved successfully
   */
  async getWeeklyStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await dashboardService.getWeeklyStats(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Weekly stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /dashboard/timeline:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get recent applications timeline
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Timeline retrieved successfully
   */
  async getTimeline(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit } = req.query as { limit?: string };
      const timeline = await dashboardService.getTimeline(
        req.userId!,
        limit ? parseInt(limit, 10) : 10
      );
      res.status(200).json({
        success: true,
        message: 'Timeline retrieved successfully',
        data: timeline,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /dashboard/companies:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get top companies analytics
   *     responses:
   *       200:
   *         description: Company analytics retrieved successfully
   */
  async getCompanyAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companies = await dashboardService.getCompanyAnalytics(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Company analytics retrieved successfully',
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
