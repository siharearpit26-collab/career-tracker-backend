import { Response, NextFunction } from 'express';
import { applicationService } from '../services/application.service';
import { AuthenticatedRequest } from '../types';

export class ApplicationController {
  /**
   * @swagger
   * /applications:
   *   post:
   *     tags: [Applications]
   *     summary: Create a new job application
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [company, jobTitle]
   *             properties:
   *               company:
   *                 type: string
   *                 example: Google
   *               jobTitle:
   *                 type: string
   *                 example: Senior Software Engineer
   *               location:
   *                 type: string
   *                 example: Remote
   *               source:
   *                 type: string
   *                 enum: [LinkedIn, Indeed, Company Website, Referral, Job Fair, Recruiter, Other]
   *               status:
   *                 type: string
   *                 enum: [Applied, Shortlisted, Interview Scheduled, Interview Completed, Offer, Rejected, Withdrawn]
   *               salaryMin:
   *                 type: number
   *               salaryMax:
   *                 type: number
   *     responses:
   *       201:
   *         description: Application created successfully
   */
  async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.createApplication(
        req.userId!,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Application created successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications:
   *   get:
   *     tags: [Applications]
   *     summary: Get all applications with filters and pagination
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *     responses:
   *       200:
   *         description: Applications retrieved successfully
   */
  async getAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        sortBy = 'appliedDate',
        sortOrder = 'desc',
        status,
        source,
        company,
        location,
        search,
        dateFrom,
        dateTo,
        salaryMin,
        salaryMax,
        isArchived,
      } = req.query as Record<string, string>;

      const pagination = {
        page: Math.max(1, parseInt(page, 10)),
        limit: Math.min(100, Math.max(1, parseInt(limit, 10))),
        sortBy,
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters = {
        status: status as Parameters<typeof applicationService.getApplications>[1]['status'],
        source: source as Parameters<typeof applicationService.getApplications>[1]['source'],
        company,
        location,
        search,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        salaryMin: salaryMin ? parseFloat(salaryMin) : undefined,
        salaryMax: salaryMax ? parseFloat(salaryMax) : undefined,
        isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
      };

      const result = await applicationService.getApplications(
        req.userId!,
        filters,
        pagination
      );

      res.status(200).json({
        success: true,
        message: 'Applications retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}:
   *   get:
   *     tags: [Applications]
   *     summary: Get application by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application retrieved successfully
   *       404:
   *         description: Application not found
   */
  async getById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.getApplicationById(
        req.params['id']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Application retrieved successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}:
   *   put:
   *     tags: [Applications]
   *     summary: Update application
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application updated successfully
   */
  async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.updateApplication(
        req.params['id']!,
        req.userId!,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Application updated successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}:
   *   delete:
   *     tags: [Applications]
   *     summary: Delete application
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application deleted successfully
   */
  async delete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await applicationService.deleteApplication(
        req.params['id']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Application deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}/status:
   *   patch:
   *     tags: [Applications]
   *     summary: Update application status
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [Applied, Shortlisted, Interview Scheduled, Interview Completed, Offer, Rejected, Withdrawn]
   *     responses:
   *       200:
   *         description: Status updated successfully
   */
  async updateStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status } = req.body as { status: string };
      const application = await applicationService.updateStatus(
        req.params['id']!,
        req.userId!,
        status
      );

      res.status(200).json({
        success: true,
        message: 'Application status updated successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}/archive:
   *   patch:
   *     tags: [Applications]
   *     summary: Archive application
   */
  async archive(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.archiveApplication(
        req.params['id']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Application archived successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}/unarchive:
   *   patch:
   *     tags: [Applications]
   *     summary: Unarchive application
   */
  async unarchive(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.unarchiveApplication(
        req.params['id']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Application unarchived successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/{id}/interview-stages:
   *   post:
   *     tags: [Applications]
   *     summary: Add interview stage to application
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [type]
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [Phone Screen, Technical, HR, On-site, Final, Other]
   *               date:
   *                 type: string
   *                 format: date-time
   *               notes:
   *                 type: string
   *               outcome:
   *                 type: string
   *                 enum: [Passed, Failed, Pending, Cancelled]
   *     responses:
   *       200:
   *         description: Interview stage added
   */
  async addInterviewStage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const application = await applicationService.addInterviewStage(
        req.params['id']!,
        req.userId!,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Interview stage added successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /applications/stats:
   *   get:
   *     tags: [Applications]
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
      const stats = await applicationService.getStats(req.userId!);

      res.status(200).json({
        success: true,
        message: 'Application stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();
