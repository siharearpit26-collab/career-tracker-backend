import { emailRepository } from '../repositories/email.repository';
import { emailSyncService } from './emailSync.service';
import { applicationRepository } from '../repositories/application.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { userRepository } from '../repositories/user.repository';
import { sendStatusUpdateEmail } from '../utils/email.utils';
import {
  exchangeGmailCode,
  exchangeOutlookCode,
  getGmailAuthUrl,
  getOutlookAuthUrl,
} from '../utils/oauth.utils';
import {
  IEmailAccountDocument,
  IEmailSyncDocument,
  EmailSyncResult,
  EmailClassificationType,
  PaginatedResult,
} from '../types';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../utils/errors';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { logger } from '../utils/logger';

export class EmailService {
  // Get OAuth URL for connecting an email account
  getAuthUrl(provider: 'gmail' | 'outlook', redirectUri: string): string {
    if (provider === 'gmail') {
      return getGmailAuthUrl(redirectUri);
    }
    return getOutlookAuthUrl(redirectUri);
  }

  // Connect email account using OAuth code
  async connectAccount(
    userId: string,
    provider: 'gmail' | 'outlook',
    code: string,
    redirectUri: string
  ): Promise<IEmailAccountDocument> {
    // Exchange code for tokens
    const tokens =
      provider === 'gmail'
        ? await exchangeGmailCode(code, redirectUri)
        : await exchangeOutlookCode(code, redirectUri);

    // Check if account already connected
    const existing = await emailRepository.findAccountByEmail(
      userId,
      tokens.email
    );

    if (existing) {
      if (existing.isActive) {
        throw new ConflictError('This email account is already connected');
      }
      // Reactivate if previously disconnected
      const reactivated = await emailRepository.updateAccountTokens(
        existing._id.toString(),
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        }
      );
      if (reactivated) {
        reactivated.isActive = true;
        await reactivated.save();
      }
      return reactivated!;
    }

    // Create new account
    return emailRepository.createAccount({
      userId,
      provider,
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    });
  }

  // Get all connected accounts for a user
  async getAccounts(userId: string): Promise<IEmailAccountDocument[]> {
    return emailRepository.findAccountsByUserId(userId);
  }

  // Disconnect an email account
  async disconnectAccount(id: string, userId: string): Promise<void> {
    const account = await emailRepository.deactivateAccount(id, userId);
    if (!account) {
      throw new NotFoundError('Email account not found');
    }
  }

  // Delete an email account and all its sync data
  async deleteAccount(id: string, userId: string): Promise<void> {
    const deleted = await emailRepository.deleteAccount(id, userId);
    if (!deleted) {
      throw new NotFoundError('Email account not found');
    }
    // Clean up sync records
    await emailRepository.deleteByAccountId(id);
  }

  // Trigger manual sync for all user accounts
  async syncAll(userId: string): Promise<EmailSyncResult> {
    const accounts = await emailRepository.findAccountsByUserId(userId);

    if (accounts.length === 0) {
      throw new BadRequestError('No email accounts connected');
    }

    const totalResult: EmailSyncResult = {
      newEmails: 0,
      classified: 0,
      matched: 0,
      statusUpdates: 0,
    };

    for (const account of accounts) {
      try {
        const result = await emailSyncService.syncAccount(account);
        totalResult.newEmails += result.newEmails;
        totalResult.classified += result.classified;
        totalResult.matched += result.matched;
        totalResult.statusUpdates += result.statusUpdates;
      } catch (error) {
        logger.error(`Sync failed for account ${account.email}:`, error);
      }
    }

    return totalResult;
  }

  // Sync a specific account
  async syncAccount(
    accountId: string,
    userId: string
  ): Promise<EmailSyncResult> {
    const accounts = await emailRepository.findAccountsByUserId(userId);
    const account = accounts.find((a) => a._id.toString() === accountId);

    if (!account) {
      throw new NotFoundError('Email account not found');
    }

    return emailSyncService.syncAccount(account);
  }

  // Get classified emails
  async getClassifications(
    userId: string,
    filters: {
      classification?: EmailClassificationType;
      isConfirmed?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResult<IEmailSyncDocument>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      emailRepository.findSyncsByUserId(
        userId,
        {
          classification: filters.classification,
          isConfirmed: filters.isConfirmed,
        },
        skip,
        limit
      ),
      emailRepository.countSyncsByUserId(userId, {
        classification: filters.classification,
        isConfirmed: filters.isConfirmed,
      }),
    ]);

    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy: 'receivedAt',
      sortOrder: 'desc',
    });
  }

  // Confirm or correct a classification
  async confirmClassification(
    id: string,
    userId: string,
    isCorrect: boolean,
    correctedClassification?: EmailClassificationType,
    correctedApplicationId?: string
  ): Promise<IEmailSyncDocument> {
    const updated = await emailRepository.updateClassification(id, userId, {
      classification: isCorrect ? undefined : correctedClassification,
      applicationId: correctedApplicationId,
      isConfirmed: true,
    });

    if (!updated) {
      throw new NotFoundError('Email classification not found');
    }

    // Apply status update when user confirms
    const finalClassification = isCorrect
      ? updated.classification
      : (correctedClassification ?? updated.classification);

    const finalApplicationId = correctedApplicationId
      ?? updated.applicationId?.toString();

    const statusMap: Partial<Record<EmailClassificationType, string>> = {
      interview: 'Interview Scheduled',
      offer: 'Offer',
      rejection: 'Rejected',
    };

    const suggestedStatus = statusMap[finalClassification];

    if (finalApplicationId && suggestedStatus) {
      try {
        await applicationRepository.update(
          finalApplicationId,
          userId,
          { status: suggestedStatus as 'Interview Scheduled' | 'Offer' | 'Rejected' }
        );

        await notificationRepository.create({
          userId,
          title: 'Application status updated',
          message: `Your application status was manually updated to "${suggestedStatus}"`,
          type: 'application_update',
          applicationId: finalApplicationId,
        });

        // Send email notification (non-blocking)
        void (async () => {
          try {
            const user = await userRepository.findById(userId);
            const app = await applicationRepository.findByIdAndUserId(
              finalApplicationId,
              userId
            );
            if (user && app && user.preferences?.emailNotifications !== false) {
              await sendStatusUpdateEmail(
                user.email,
                user.firstName,
                app.company,
                app.jobTitle,
                suggestedStatus
              );
            }
          } catch (emailErr) {
            logger.warn('Failed to send status update email notification:', emailErr);
          }
        })();

      } catch (err) {
        logger.warn('Failed to update application status on confirmation:', err);
      }
    }

    return updated;
  }

  // Get sync history
  async getSyncHistory(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedResult<IEmailSyncDocument>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      emailRepository.getSyncHistory(userId, skip, limit),
      emailRepository.countSyncsByUserId(userId, {}),
    ]);

    return buildPaginatedResult(data, total, {
      page,
      limit,
      sortBy: 'processedAt',
      sortOrder: 'desc',
    });
  }
}

export const emailService = new EmailService();
