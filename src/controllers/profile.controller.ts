import { Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { resumeParserService } from '../services/resumeParser.service';
import { logger } from '../utils/logger';
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
   *     summary: Upload resume PDF and auto-extract job preferences
   *     responses:
   *       200:
   *         description: Resume uploaded and parsed
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

      // Parse resume in background and auto-populate job preferences
      let parsedResume = null;
      try {
        logger.info(`Resume upload: parsing file at ${req.file.path}`);
        parsedResume = await resumeParserService.parseResume(req.file.path);
        logger.info(`Resume parse result: ${parsedResume ? 'success' : 'null'}`);

        if (parsedResume) {
          // Auto-update job preferences from parsed resume
          await profileService.updateJobPreferences(req.userId!, {
            preferredRoles: parsedResume.preferredRoles,
            skills: parsedResume.skills,
            experienceYears: parsedResume.experienceYears,
            preferredLocations: parsedResume.preferredLocations,
            preferredWorkArrangement: parsedResume.preferredWorkArrangement,
            salaryExpectation: parsedResume.salaryExpectation ?? undefined,
            salaryCurrency: parsedResume.salaryCurrency,
          });
          logger.info(`Job preferences updated from resume for user ${req.userId}`);
        }
      } catch (parseError) {
        // Non-critical — resume is still saved even if parsing fails
        logger.error('Resume parsing failed (non-critical):', parseError);
      }

      res.status(200).json({
        success: true,
        message: parsedResume
          ? 'Resume uploaded and job preferences updated from your resume!'
          : 'Resume uploaded successfully',
        data: {
          profile,
          parsedResume,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/parse-resume:
   *   post:
   *     tags: [Profile]
   *     summary: Parse the uploaded resume with AI
   *     responses:
   *       200:
   *         description: Resume parsed
   */
  async parseResume(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await profileService.getProfile(req.userId!);
      if (!user.resumeUrl) {
        res.status(400).json({ success: false, message: 'No resume uploaded. Upload a resume first.' });
        return;
      }

      const filePath = user.resumeUrl.replace(/^\//, '');
      logger.info(`Parsing resume: ${filePath}`);

      const parsedResume = await resumeParserService.parseResume(filePath);

      if (!parsedResume) {
        res.status(500).json({ success: false, message: 'AI parsing failed. Please try again later.' });
        return;
      }

      // Auto-update job preferences
      await profileService.updateJobPreferences(req.userId!, {
        preferredRoles: parsedResume.preferredRoles,
        skills: parsedResume.skills,
        experienceYears: parsedResume.experienceYears,
        preferredLocations: parsedResume.preferredLocations,
        preferredWorkArrangement: parsedResume.preferredWorkArrangement,
        salaryExpectation: parsedResume.salaryExpectation ?? undefined,
        salaryCurrency: parsedResume.salaryCurrency,
      });

      logger.info(`Resume parsed and preferences updated for user ${req.userId}`);

      res.status(200).json({
        success: true,
        message: 'Resume parsed! Job preferences updated.',
        data: parsedResume,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/job-preferences:
   *   get:
   *     tags: [Profile]
   *     summary: Get job matching preferences
   *     responses:
   *       200:
   *         description: Job preferences retrieved
   */
  async getJobPreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const prefs = await profileService.getJobPreferences(req.userId!);
      res.status(200).json({
        success: true,
        message: 'Job preferences retrieved',
        data: prefs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /profile/job-preferences:
   *   put:
   *     tags: [Profile]
   *     summary: Update job matching preferences
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               preferredRoles:
   *                 type: array
   *                 items:
   *                   type: string
   *               skills:
   *                 type: array
   *                 items:
   *                   type: string
   *               experienceYears:
   *                 type: number
   *               preferredLocations:
   *                 type: array
   *                 items:
   *                   type: string
   *               preferredWorkArrangement:
   *                 type: array
   *                 items:
   *                   type: string
   *               salaryExpectation:
   *                 type: number
   *               salaryCurrency:
   *                 type: string
   *     responses:
   *       200:
   *         description: Job preferences updated
   */
  async updateJobPreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const prefs = await profileService.updateJobPreferences(req.userId!, req.body);
      res.status(200).json({
        success: true,
        message: 'Job preferences updated',
        data: prefs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
