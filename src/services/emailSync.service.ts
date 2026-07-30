import { emailRepository } from '../repositories/email.repository';
import { emailClassifierService } from './emailClassifier.service';
import { applicationRepository } from '../repositories/application.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { decrypt } from '../utils/encryption.utils';
import { refreshGmailToken, refreshOutlookToken } from '../utils/oauth.utils';
import { EmailSyncResult, IEmailAccountDocument } from '../types';
import { logger } from '../utils/logger';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
  internalDate: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface OutlookMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  receivedDateTime: string;
  bodyPreview: string;
}

interface OutlookListResponse {
  value: OutlookMessage[];
  '@odata.nextLink'?: string;
}

export class EmailSyncService {
  async syncAccount(account: IEmailAccountDocument): Promise<EmailSyncResult> {
    const result: EmailSyncResult = {
      newEmails: 0,
      classified: 0,
      matched: 0,
      statusUpdates: 0,
    };

    try {
      // Refresh token if expired
      const accountWithTokens = await emailRepository.findAccountByIdWithTokens(
        account._id.toString()
      );

      if (!accountWithTokens) {
        throw new Error('Account not found');
      }

      let accessToken = accountWithTokens.accessToken;

      if (new Date() >= accountWithTokens.tokenExpiresAt) {
        accessToken = await this.refreshToken(accountWithTokens);
      }

      const decryptedToken = decrypt(accessToken);

      // Fetch emails based on provider
      const emails =
        account.provider === 'gmail'
          ? await this.fetchGmailEmails(decryptedToken, account.syncCursor)
          : await this.fetchOutlookEmails(decryptedToken, account.lastSyncedAt);

      // Process each email
      for (const email of emails) {
        // Check if already synced
        const existing = await emailRepository.findSyncByMessageId(
          account._id.toString(),
          email.messageId
        );

        if (existing) continue;

        result.newEmails++;

        // Classify the email
        const classification = await emailClassifierService.classify(
          account.userId.toString(),
          email.subject,
          email.snippet,
          email.from
        );

        result.classified++;

        // Save sync record
        await emailRepository.createSyncRecord({
          emailAccountId: account._id.toString(),
          userId: account.userId.toString(),
          messageId: email.messageId,
          subject: email.subject,
          from: email.from,
          receivedAt: email.receivedAt,
          snippet: email.snippet,
          classification: classification.classification,
          confidence: classification.confidence,
          applicationId: classification.applicationId,
          statusUpdate: classification.suggestedStatus,
        });

        if (classification.applicationId) {
          result.matched++;
        }

        // Auto-update status for high confidence matches
        if (
          classification.confidence >= 0.8 &&
          classification.applicationId &&
          classification.suggestedStatus
        ) {
          try {
            await applicationRepository.update(
              classification.applicationId,
              account.userId.toString(),
              { status: classification.suggestedStatus as 'Applied' | 'Interview Scheduled' | 'Offer' | 'Rejected' }
            );
            result.statusUpdates++;

            // Create notification
            await notificationRepository.create({
              userId: account.userId.toString(),
              title: `Application status updated`,
              message: `Your application status was updated to "${classification.suggestedStatus}" based on an email from ${email.from}`,
              type: 'application_update',
              applicationId: classification.applicationId,
            });
          } catch (err) {
            logger.warn('Failed to auto-update application status:', err);
          }
        }

        // Notify user for low-confidence classifications needing confirmation
        if (
          classification.confidence < 0.7 &&
          classification.classification !== 'unrelated'
        ) {
          await notificationRepository.create({
            userId: account.userId.toString(),
            title: `Email needs review`,
            message: `An email from ${email.from} was classified as "${classification.classification}" with low confidence. Please review.`,
            type: 'system',
          });
        }
      }

      // Update sync cursor
      await emailRepository.updateSyncCursor(
        account._id.toString(),
        new Date().toISOString(),
        new Date()
      );

      logger.info(
        `Email sync completed for ${account.email}: ${result.newEmails} new, ${result.matched} matched, ${result.statusUpdates} updates`
      );

      return result;
    } catch (error) {
      logger.error(`Email sync failed for ${account.email}:`, error);
      throw error;
    }
  }

  private async refreshToken(
    account: IEmailAccountDocument
  ): Promise<string> {
    if (account.provider === 'gmail') {
      const refreshed = await refreshGmailToken(account.refreshToken);
      await emailRepository.updateAccountTokens(account._id.toString(), {
        accessToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    } else {
      const refreshed = await refreshOutlookToken(account.refreshToken);
      await emailRepository.updateAccountTokens(account._id.toString(), {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    }
  }

  private async fetchGmailEmails(
    accessToken: string,
    _syncCursor?: string
  ): Promise<
    Array<{
      messageId: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }>
  > {
    const emails: Array<{
      messageId: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }> = [];

    try {
      // Fetch recent messages (last 7 days)
      const after = Math.floor(
        (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000
      );
      const query = `after:${after}`;

      const listResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listResponse.ok) {
        throw new Error(`Gmail API error: ${listResponse.status}`);
      }

      const listData = (await listResponse.json()) as GmailListResponse;

      if (!listData.messages) return emails;

      // Fetch individual messages (limit to 20 per sync)
      const messagesToFetch = listData.messages.slice(0, 20);

      for (const msg of messagesToFetch) {
        const msgResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) continue;

        const msgData = (await msgResponse.json()) as GmailMessage;

        const subject =
          msgData.payload.headers.find((h) => h.name === 'Subject')?.value ??
          '(no subject)';
        const from =
          msgData.payload.headers.find((h) => h.name === 'From')?.value ?? '';

        emails.push({
          messageId: msgData.id,
          subject,
          from,
          receivedAt: new Date(parseInt(msgData.internalDate, 10)),
          snippet: msgData.snippet ?? '',
        });
      }
    } catch (error) {
      logger.error('Failed to fetch Gmail emails:', error);
      throw error;
    }

    return emails;
  }

  private async fetchOutlookEmails(
    accessToken: string,
    lastSyncedAt?: Date
  ): Promise<
    Array<{
      messageId: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }>
  > {
    const emails: Array<{
      messageId: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }> = [];

    try {
      let url =
        'https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview';

      if (lastSyncedAt) {
        url += `&$filter=receivedDateTime ge ${lastSyncedAt.toISOString()}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Outlook API error: ${response.status}`);
      }

      const data = (await response.json()) as OutlookListResponse;

      for (const msg of data.value.slice(0, 20)) {
        emails.push({
          messageId: msg.id,
          subject: msg.subject,
          from: msg.from.emailAddress.address,
          receivedAt: new Date(msg.receivedDateTime),
          snippet: msg.bodyPreview,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch Outlook emails:', error);
      throw error;
    }

    return emails;
  }
}

export const emailSyncService = new EmailSyncService();
