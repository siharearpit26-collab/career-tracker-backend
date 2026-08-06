import { emailRepository } from '../repositories/email.repository';
import { emailClassifierService } from './emailClassifier.service';
import { applicationRepository } from '../repositories/application.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { decrypt } from '../utils/encryption.utils';
import { refreshGmailToken, refreshOutlookToken } from '../utils/oauth.utils';
import { EmailSyncResult, IEmailAccountDocument } from '../types';
import { logger } from '../utils/logger';
import { sendStatusUpdateEmail } from '../utils/email.utils';
import { userRepository } from '../repositories/user.repository';

// Extract company name from sender email/display name
// e.g. "HR Team <hr@google.com>" → "Google"
// e.g. "noreply@greenhouse.io" → null (skip platform domains)
const SKIP_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'greenhouse.io', 'lever.co', 'workday.com', 'smartrecruiters.com',
  'ashbyhq.com', 'jobvite.com', 'icims.com', 'taleo.net', 'bamboohr.com',
];

function extractCompanyFromSender(from: string): string | null {
  // Try display name first: "Google Careers <jobs@google.com>"
  const displayMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (displayMatch?.[1]) {
    const name = displayMatch[1].trim()
      .replace(/\b(careers|jobs|hr|noreply|no-reply|recruiting|talent|team|notifications?|support)\b/gi, '')
      .replace(/[^a-zA-Z0-9 &.-]/g, '')
      .trim();
    if (name.length > 2) return capitalizeWords(name);
  }

  // Try domain: "hr@google.com" → "Google"
  const domainMatch = from.match(/@([^.>]+)\./);
  if (domainMatch?.[1]) {
    const domain = domainMatch[1].toLowerCase();
    if (SKIP_DOMAINS.some((d) => d.startsWith(domain))) return null;
    if (['hr', 'jobs', 'careers', 'noreply', 'mail', 'info', 'hello', 'team'].includes(domain)) return null;
    return capitalizeWords(domain);
  }

  return null;
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      autoCreated: 0,
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

      // Process each email in batches of 20 concurrently
      const BATCH_SIZE = 20;
      const batchStats = {
        total: emails.length,
        preFilterPass: 0,
        aiAnalyzed: 0,
        cacheHits: 0,
        matched: 0,
        autoCreated: 0,
        autoUpdated: 0,
        failed: 0,
      };

      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (email) => {
          try {
            // Check if already synced
            const existing = await emailRepository.findSyncByMessageId(
              account._id.toString(),
              email.messageId
            );
            if (existing) return;

            result.newEmails++;

            // Classify the email (Stage 1 pre-filter + Stage 2 AI or fallback)
            const classification = await emailClassifierService.classify(
              account.userId.toString(),
              email.subject,
              email.snippet,
              email.from,
              email.threadId
            );

            if (classification.processingMethod !== 'pre_filter') {
              batchStats.preFilterPass++;
              if (classification.processingMethod === 'ai') batchStats.aiAnalyzed++;
            }
            result.classified++;

            // Save sync record with all AI fields
            await emailRepository.createSyncRecord({
              emailAccountId: account._id.toString(),
              userId: account.userId.toString(),
              messageId: email.messageId,
              threadId: email.threadId,
              subject: email.subject,
              from: email.from,
              receivedAt: email.receivedAt,
              snippet: email.snippet,
              classification: classification.classification,
              category: classification.category,
              confidence: classification.confidence,
              applicationId: classification.applicationId,
              statusUpdate: classification.suggestedStatus,
              processingMethod: classification.processingMethod,
              fallbackReason: classification.fallbackReason,
              recruiterName: classification.recruiterName,
              recruiterEmail: classification.recruiterEmail,
              salaryMin: classification.salaryMin,
              salaryMax: classification.salaryMax,
              salaryCurrency: classification.salaryCurrency,
              location: classification.location,
              requiredAction: classification.requiredAction,
              summary: classification.summary,
              importantDates: classification.importantDates,
              isPendingReview: classification.isPendingReview,
            });

            if (classification.applicationId) {
              result.matched++;
              batchStats.matched++;
            }

            // ── Auto-create application if AI found company but no match ──
            let resolvedApplicationId = classification.applicationId;

            if (
              !resolvedApplicationId &&
              classification.classification !== 'unrelated' &&
              classification.confidence >= 0.6
            ) {
              const company = classification.aiCompany ?? extractCompanyFromSender(email.from);
              const jobTitle = classification.aiJobTitle ?? 'Position';

              if (company && company.length > 1) {
                try {
                  const newApp = await applicationRepository.create(
                    account.userId.toString(),
                    {
                      company,
                      jobTitle,
                      status: (classification.suggestedStatus as 'Applied' | 'Shortlisted' | 'Interview Scheduled' | 'Offer' | 'Rejected') ?? 'Applied',
                      source: 'Other',
                      appliedDate: email.receivedAt,
                      notes: `Auto-created from email: "${email.subject}"\n\nSender: ${email.from}${classification.summary ? `\n\nSummary: ${classification.summary}` : ''}`,
                      location: classification.location,
                      salaryMin: classification.salaryMin,
                      salaryMax: classification.salaryMax,
                      salaryCurrency: classification.salaryCurrency,
                    }
                  );

                  resolvedApplicationId = newApp._id.toString();
                  result.matched++;
                  result.autoCreated = (result.autoCreated ?? 0) + 1;
                  batchStats.matched++;
                  batchStats.autoCreated++;

                  logger.info(`Auto-created application for "${company}" from email "${email.subject}"`);

                  // Update sync record with new applicationId
                  const syncRecord = await emailRepository.findSyncByMessageId(
                    account._id.toString(), email.messageId
                  );
                  if (syncRecord) {
                    await emailRepository.updateClassification(
                      syncRecord._id.toString(),
                      account.userId.toString(),
                      { applicationId: resolvedApplicationId, isConfirmed: false }
                    );
                  }

                  // Notify user
                  await notificationRepository.create({
                    userId: account.userId.toString(),
                    title: `New application auto-created: ${company}`,
                    message: `An email about a ${jobTitle} position at ${company} was detected and automatically added to your applications.`,
                    type: 'application_update',
                    applicationId: resolvedApplicationId,
                  });

                } catch (createErr) {
                  logger.warn(`Failed to auto-create application for "${company}":`, createErr);
                }
              }
            }

            // ── Confidence-based status update logic ──────────────────────
            const conf = classification.confidence;

            if (
              conf >= 0.75 &&                          // High confidence threshold
              resolvedApplicationId &&
              classification.suggestedStatus &&
              !classification.isPendingReview
            ) {
              // Auto-update
              try {
                const prevApp = await applicationRepository.findByIdAndUserId(
                  resolvedApplicationId,
                  account.userId.toString()
                );
                const prevStatus = prevApp?.status;

                await applicationRepository.update(
                  resolvedApplicationId,
                  account.userId.toString(),
                  { status: classification.suggestedStatus as 'Applied' | 'Interview Scheduled' | 'Offer' | 'Rejected' | 'Shortlisted' }
                );
                result.statusUpdates++;
                batchStats.autoUpdated++;

                // Audit log
                const { ActivityLogModel } = await import('../models');
                await ActivityLogModel.create({
                  userId: account.userId,
                  action: `Auto-updated application status: ${prevStatus ?? 'Unknown'} → ${classification.suggestedStatus}`,
                  entity: 'Application',
                  entityId: resolvedApplicationId,
                  details: {
                    previousStatus: prevStatus,
                    newStatus: classification.suggestedStatus,
                    sourceEmailMessageId: email.messageId,
                    confidence: classification.confidence,
                    processingMethod: classification.processingMethod,
                  },
                  level: 'info',
                });

                // In-app notification
                await notificationRepository.create({
                  userId: account.userId.toString(),
                  title: 'Application status updated',
                  message: `${classification.summary ?? `Status updated to "${classification.suggestedStatus}"`} — from ${email.from}`,
                  type: 'application_update',
                  applicationId: classification.applicationId,
                });

                // Email notification (non-blocking)
                void (async () => {
                  try {
                    const user = await userRepository.findById(account.userId.toString());
                    const app = await applicationRepository.findByIdAndUserId(
                      resolvedApplicationId!,
                      account.userId.toString()
                    );
                    if (user && app && user.preferences?.emailNotifications !== false) {
                      await sendStatusUpdateEmail(
                        user.email,
                        user.firstName,
                        app.company,
                        app.jobTitle,
                        classification.suggestedStatus!,
                        email.from
                      );
                    }
                  } catch (emailErr) {
                    logger.warn('Failed to send status update email:', emailErr);
                  }
                })();
              } catch (err) {
                logger.warn('Auto-update failed:', err);
                batchStats.failed++;
              }
            } else if (
              conf >= 0.5 && conf < 0.75 &&
              resolvedApplicationId &&
              classification.suggestedStatus
            ) {
              await notificationRepository.create({
                userId: account.userId.toString(),
                title: 'Suggested status update available',
                message: `An email suggests your application status may be "${classification.suggestedStatus}". Review in Email Feed.`,
                type: 'application_update',
                applicationId: resolvedApplicationId,
              });
            } else if (
              conf < 0.5 &&                            // Low confidence — ask user
              classification.classification !== 'unrelated'
            ) {
              await notificationRepository.create({
                userId: account.userId.toString(),
                title: 'Email needs review',
                message: `An email from ${email.from} was classified as "${classification.classification}" with low confidence. Please review in Email Feed.`,
                type: 'system',
              });
            }
          } catch (err) {
            logger.error(`Failed to process email "${email.subject}":`, err);
            batchStats.failed++;
          }
        }));
      }

      logger.info(`Email sync batch complete for ${account.email}: ${JSON.stringify(batchStats)}`);

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
      threadId?: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }>
  > {
    const emails: Array<{
      messageId: string;
      threadId?: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }> = [];

    try {
      // Fetch recent messages (last 30 days)
      const after = Math.floor(
        (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
      );
      const query = `after:${after}`;

      const listResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
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
          threadId: msgData.threadId,
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
      threadId?: string;
      subject: string;
      from: string;
      receivedAt: Date;
      snippet: string;
    }>
  > {
    const emails: Array<{
      messageId: string;
      threadId?: string;
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
