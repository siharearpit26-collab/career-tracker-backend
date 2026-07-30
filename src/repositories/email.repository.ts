import { Types } from 'mongoose';
import { EmailAccountModel, EmailSyncModel } from '../models';
import {
  IEmailAccountDocument,
  IEmailSyncDocument,
  EmailClassificationType,
} from '../types';

export class EmailRepository {
  // Email Account operations
  async createAccount(data: {
    userId: string;
    provider: 'gmail' | 'outlook';
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<IEmailAccountDocument> {
    return EmailAccountModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId),
    });
  }

  async findAccountById(id: string): Promise<IEmailAccountDocument | null> {
    return EmailAccountModel.findById(id);
  }

  async findAccountByIdWithTokens(
    id: string
  ): Promise<IEmailAccountDocument | null> {
    return EmailAccountModel.findById(id).select('+accessToken +refreshToken');
  }

  async findAccountsByUserId(
    userId: string
  ): Promise<IEmailAccountDocument[]> {
    return EmailAccountModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });
  }

  async findAccountByEmail(
    userId: string,
    email: string
  ): Promise<IEmailAccountDocument | null> {
    return EmailAccountModel.findOne({
      userId: new Types.ObjectId(userId),
      email: email.toLowerCase(),
    });
  }

  async updateAccountTokens(
    id: string,
    data: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt: Date;
    }
  ): Promise<IEmailAccountDocument | null> {
    return EmailAccountModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );
  }

  async updateSyncCursor(
    id: string,
    syncCursor: string,
    lastSyncedAt: Date
  ): Promise<void> {
    await EmailAccountModel.findByIdAndUpdate(id, {
      $set: { syncCursor, lastSyncedAt },
    });
  }

  async deactivateAccount(
    id: string,
    userId: string
  ): Promise<IEmailAccountDocument | null> {
    return EmailAccountModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { isActive: false } },
      { new: true }
    );
  }

  async deleteAccount(id: string, userId: string): Promise<boolean> {
    const result = await EmailAccountModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  // Email Sync operations
  async createSyncRecord(data: {
    emailAccountId: string;
    userId: string;
    messageId: string;
    subject: string;
    from: string;
    receivedAt: Date;
    snippet: string;
    classification: EmailClassificationType;
    confidence: number;
    applicationId?: string;
    statusUpdate?: string;
  }): Promise<IEmailSyncDocument> {
    return EmailSyncModel.create({
      ...data,
      emailAccountId: new Types.ObjectId(data.emailAccountId),
      userId: new Types.ObjectId(data.userId),
      applicationId: data.applicationId
        ? new Types.ObjectId(data.applicationId)
        : undefined,
      processedAt: new Date(),
    });
  }

  async findSyncByMessageId(
    emailAccountId: string,
    messageId: string
  ): Promise<IEmailSyncDocument | null> {
    return EmailSyncModel.findOne({
      emailAccountId: new Types.ObjectId(emailAccountId),
      messageId,
    });
  }

  async findSyncsByUserId(
    userId: string,
    filters: {
      classification?: EmailClassificationType;
      isConfirmed?: boolean;
    },
    skip = 0,
    limit = 20
  ): Promise<IEmailSyncDocument[]> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.classification) query['classification'] = filters.classification;
    if (filters.isConfirmed !== undefined) query['isConfirmed'] = filters.isConfirmed;

    return EmailSyncModel.find(query)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('applicationId', 'company jobTitle status');
  }

  async countSyncsByUserId(
    userId: string,
    filters: {
      classification?: EmailClassificationType;
      isConfirmed?: boolean;
    }
  ): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.classification) query['classification'] = filters.classification;
    if (filters.isConfirmed !== undefined) query['isConfirmed'] = filters.isConfirmed;

    return EmailSyncModel.countDocuments(query);
  }

  async updateClassification(
    id: string,
    userId: string,
    data: {
      classification?: EmailClassificationType;
      applicationId?: string;
      isConfirmed: boolean;
    }
  ): Promise<IEmailSyncDocument | null> {
    const update: Record<string, unknown> = {
      isConfirmed: data.isConfirmed,
    };

    if (data.classification) update['classification'] = data.classification;
    if (data.applicationId) {
      update['applicationId'] = new Types.ObjectId(data.applicationId);
    }

    return EmailSyncModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: update },
      { new: true }
    );
  }

  async getSyncHistory(
    userId: string,
    skip = 0,
    limit = 10
  ): Promise<IEmailSyncDocument[]> {
    return EmailSyncModel.find({
      userId: new Types.ObjectId(userId),
      classification: { $ne: 'unrelated' },
    })
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('applicationId', 'company jobTitle status')
      .populate('emailAccountId', 'email provider');
  }

  async deleteByAccountId(emailAccountId: string): Promise<void> {
    await EmailSyncModel.deleteMany({
      emailAccountId: new Types.ObjectId(emailAccountId),
    });
  }
}

export const emailRepository = new EmailRepository();
