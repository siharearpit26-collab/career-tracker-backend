import { Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { AuthenticatedRequest } from '../types';

export class ProfileController {
  /**
   * @swagger
   * /profile:
   *   get:
   *     tags: [Profile]
   *     summary: Get current user profile
   *     responses:
   *       200:
   *         description: Profile retrieved
   */
  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profile = await profileService.getProfile(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile:
   *   put:
   *     tags: [Profile]
   *     summary: Update profile
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated
   */
  async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profile = await profileService.updateProfile(req.userId!, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/preferences:
   *   patch:
   *     tags: [Profile]
   *     summary: Update user preferences
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               theme:
   *                 type: string
   *                 enum: [light, dark, system]
   *               emailNotifications:
   *                 type: boolean
   *               reminderNotifications:
   *                 type: boolean
   *               weeklyDigest:
   *                 type: boolean
   *               language:
   *                 type: string
   *               timezone:
   *                 type: string
   *     responses:
   *       200:
   *         description: Preferences updated
   */
  async updatePreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profile = await profileService.updatePreferences(
        req.userId!,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/upload-image:
   *   post:
   *     tags: [Profile]
   *     summary: Upload profile image
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Image uploaded
   */
  async uploadProfileImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      const profile = await profileService.updateProfileImage(
        req.userId!,
        imageUrl
      );
      res.status(200).json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/upload-resume:
   *   post:
   *     tags: [Profile]
   *     summary: Upload resume PDF
   *     responses:
   *       200:
   *         description: Resume uploaded
   */
  async uploadResume(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }
      const resumeUrl = `/uploads/${req.file.filename}`;
      const profile = await profileService.updateResume(req.userId!, resumeUrl);
      res.status(200).json({
        success: true,
        message: 'Resume uploaded successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
