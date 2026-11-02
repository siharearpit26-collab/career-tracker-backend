import { Response, NextFunction } from 'express';
import { emailService } from '../services/email.service';
import { AuthenticatedRequest, EmailClassificationType } from '../types';
import { logger } from '../utils/logger';

export class EmailController {
  // Get OAuth URL
  async getAuthUrl(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { provider } = req.params as { provider: 'gmail' | 'outlook' };
      const { redirectUri } = req.query as { redirectUri: string };

      if (!redirectUri) {
        res.status(400).json({
          success: false,
          message: 'redirectUri query parameter is required',
        });
        return;
      }

      if (provider !== 'gmail' && provider !== 'outlook') {
        res.status(400).json({
          success: false,
          message: 'Provider must be gmail or outlook',
        });
        return;
      }

      const url = emailService.getAuthUrl(provider, redirectUri);

      res.status(200).json({
        success: true,
        message: 'OAuth URL generated',
        data: { url },
      });
    } catch (error) {
      next(error);
    }
  }

  // Connect email account
  async connectAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { provider } = req.params as { provider: 'gmail' | 'outlook' };
      const { code, redirectUri } = req.body as {
        code: string;
        redirectUri: string;
      };

      const account = await emailService.connectAccount(
        req.userId!,
        provider,
        code,
        redirectUri
      );

      res.status(201).json({
        success: true,
        message: 'Email account connected successfully',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get connected accounts
  async getAccounts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const accounts = await emailService.getAccounts(req.userId!);

      res.status(200).json({
        success: true,
        message: 'Email accounts retrieved',
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  // Disconnect account
  async disconnectAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await emailService.disconnectAccount(req.params['id']!, req.userId!);

      res.status(200).json({
        success: true,
        message: 'Email account disconnected',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete account
  async deleteAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await emailService.deleteAccount(req.params['id']!, req.userId!);

      res.status(200).json({
        success: true,
        message: 'Email account and sync data deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  // Trigger manual sync — responds immediately, processes in background
  async syncAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Respond immediately so the request doesn't time out on Render's 30s limit
      // The actual sync runs in the background (can take minutes for 100 emails via Gemini)
      res.status(202).json({
        success: true,
        message: 'Sync started — check Email Feed in a minute for results',
        data: { newEmails: 0, classified: 0, matched: 0, statusUpdates: 0 },
      });

      // Fire and forget — errors are logged internally
      void emailService.syncAll(req.userId!).catch((err) => {
        logger.error(`Background sync failed for user ${req.userId}:`, err);
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync specific account
  async syncAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await emailService.syncAccount(
        req.params['id']!,
        req.userId!
      );

      res.status(200).json({
        success: true,
        message: 'Account sync completed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get classifications
  async getClassifications(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        classification,
        isConfirmed,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const result = await emailService.getClassifications(req.userId!, {
        classification: classification as EmailClassificationType | undefined,
        isConfirmed:
          isConfirmed === 'true'
            ? true
            : isConfirmed === 'false'
              ? false
              : undefined,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      res.status(200).json({
        success: true,
        message: 'Classifications retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Confirm classification
  async confirmClassification(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { isCorrect, correctedClassification, correctedApplicationId } =
        req.body as {
          isCorrect: boolean;
          correctedClassification?: EmailClassificationType;
          correctedApplicationId?: string;
        };

      const updated = await emailService.confirmClassification(
        id!,
        req.userId!,
        isCorrect,
        correctedClassification,
        correctedApplicationId
      );

      res.status(200).json({
        success: true,
        message: 'Classification confirmed',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // Debug: show sync state for all accounts
  async getSyncDebug(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const info = await emailService.getSyncDebugInfo(req.userId!);
      res.status(200).json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  }

  // Reset sync cursor (forces full re-fetch on next sync)
  async resetSync(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const accountId = req.params['id'];
      await emailService.resetSync(req.userId!, accountId);
      res.status(200).json({
        success: true,
        message: accountId
          ? 'Sync reset for account. Click Sync Now to re-fetch all emails.'
          : 'Sync reset for all accounts. Click Sync Now to re-fetch all emails.',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get sync history
  async getSyncHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>;

      const result = await emailService.getSyncHistory(
        req.userId!,
        parseInt(page, 10),
        parseInt(limit, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Sync history retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const emailController = new EmailController();
