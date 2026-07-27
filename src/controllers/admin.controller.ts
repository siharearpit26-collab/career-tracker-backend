import { Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../types';

export class AdminController {
  /**
   * @swagger
   * /admin/stats:
   *   get:
   *     tags: [Admin]
   *     summary: Get system-wide statistics
   *     responses:
   *       200:
   *         description: System stats
   */
  async getSystemStats(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await adminService.getSystemStats();
      res.status(200).json({
        success: true,
        message: 'System stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users:
   *   get:
   *     tags: [Admin]
   *     summary: Get all users
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
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *           enum: [user, admin]
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Users list
   */
  async getAllUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        role,
        isActive,
      } = req.query as Record<string, string>;

      const result = await adminService.getAllUsers(
        parseInt(page, 10),
        parseInt(limit, 10),
        search,
        role,
        isActive === 'true' ? true : isActive === 'false' ? false : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users/{id}:
   *   get:
   *     tags: [Admin]
   *     summary: Get user by ID
   */
  async getUserById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await adminService.getUserById(req.params['id']!);
      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users/{id}/deactivate:
   *   patch:
   *     tags: [Admin]
   *     summary: Deactivate user account
   */
  async deactivateUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await adminService.deactivateUser(req.params['id']!);
      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users/{id}/activate:
   *   patch:
   *     tags: [Admin]
   *     summary: Activate user account
   */
  async activateUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await adminService.activateUser(req.params['id']!);
      res.status(200).json({
        success: true,
        message: 'User activated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users/{id}/role:
   *   patch:
   *     tags: [Admin]
   *     summary: Update user role
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [role]
   *             properties:
   *               role:
   *                 type: string
   *                 enum: [user, admin]
   */
  async updateUserRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { role } = req.body as { role: 'user' | 'admin' };
      const user = await adminService.updateUserRole(req.params['id']!, role);
      res.status(200).json({
        success: true,
        message: 'User role updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/users/{id}:
   *   delete:
   *     tags: [Admin]
   *     summary: Delete user and all their data
   */
  async deleteUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await adminService.deleteUser(req.params['id']!);
      res.status(200).json({
        success: true,
        message: 'User and all associated data deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/logs:
   *   get:
   *     tags: [Admin]
   *     summary: Get activity logs
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
   *         name: userId
   *         schema:
   *           type: string
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *           enum: [info, warn, error]
   */
  async getActivityLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        userId,
        level,
      } = req.query as Record<string, string>;

      const logs = await adminService.getActivityLogs(
        parseInt(page, 10),
        parseInt(limit, 10),
        userId,
        level
      );

      res.status(200).json({
        success: true,
        message: 'Activity logs retrieved successfully',
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
