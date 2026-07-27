import { Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { AuthenticatedRequest } from '../types';

export class ReportController {
  /**
   * @swagger
   * /reports/monthly:
   *   post:
   *     tags: [Reports]
   *     summary: Generate monthly report (PDF or CSV)
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               format:
   *                 type: string
   *                 enum: [pdf, csv]
   *                 default: pdf
   *               month:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 12
   *               year:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Report file download
   */
  async generateMonthly(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { format = 'pdf', month, year } = req.body as {
        format?: 'pdf' | 'csv';
        month?: number;
        year?: number;
      };

      const result = await reportService.generateMonthlyReport(
        req.userId!,
        format,
        month,
        year
      );

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`
      );
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reports/yearly:
   *   post:
   *     tags: [Reports]
   *     summary: Generate yearly report (PDF or CSV)
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               format:
   *                 type: string
   *                 enum: [pdf, csv]
   *                 default: pdf
   *               year:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Report file download
   */
  async generateYearly(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { format = 'pdf', year } = req.body as {
        format?: 'pdf' | 'csv';
        year?: number;
      };

      const result = await reportService.generateYearlyReport(
        req.userId!,
        format,
        year
      );

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`
      );
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reports/custom:
   *   post:
   *     tags: [Reports]
   *     summary: Generate custom date range report
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [type, format, dateRange]
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [monthly, yearly, custom]
   *               format:
   *                 type: string
   *                 enum: [pdf, csv]
   *               dateRange:
   *                 type: object
   *                 properties:
   *                   startDate:
   *                     type: string
   *                     format: date
   *                   endDate:
   *                     type: string
   *                     format: date
   *     responses:
   *       200:
   *         description: Report file download
   */
  async generateCustom(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await reportService.generateReport(req.userId!, req.body);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`
      );
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reports/history:
   *   get:
   *     tags: [Reports]
   *     summary: Get report generation history
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Report history retrieved
   */
  async getHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>;
      const history = await reportService.getReportHistory(
        req.userId!,
        parseInt(page, 10),
        parseInt(limit, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Report history retrieved successfully',
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /reports/{id}:
   *   delete:
   *     tags: [Reports]
   *     summary: Delete a report record
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Report deleted
   */
  async deleteReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await reportService.deleteReport(req.params['id']!, req.userId!);
      res.status(200).json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
