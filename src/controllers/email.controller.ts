import { Response, NextFunction } from 'express';
import { emailService } from '../services/email.service';
import { AuthenticatedRequest, EmailClassificationType } from '../types';

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

  // Trigger manual sync
  async syncAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await emailService.syncAll(req.userId!);

      res.status(200).json({
        success: true,
        message: 'Email sync completed',
        data: result,
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
