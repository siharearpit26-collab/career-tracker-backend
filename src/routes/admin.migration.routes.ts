/**
 * One-time migration endpoint to auto-create applications from existing email sync records.
 * POST /api/v1/admin/migrate-emails
 */
import { Router, Request, Response, RequestHandler } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { EmailSyncModel } from '../models';
import { applicationRepository } from '../repositories/application.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

const router = Router();
router.use(authenticate as RequestHandler);
router.use(authorize('admin') as RequestHandler);

const JOB_PLATFORMS = [
  'linkedin', 'naukri', 'indeed', 'glassdoor', 'monster', 'shine',
  'foundit', 'campus', 'workday', 'lever', 'greenhouse', 'ziprecruiter',
  'wellfound', 'unstop', 'internshala', 'hirist', 'cutshort', 'angellist',
  'iimjobs', 'timesjobs', 'applyboard', 'freshteam',
];

function extractCompany(from: string): string | undefined {
  const displayMatch = from.match(/^([^<]+)</);
  if (displayMatch?.[1]) {
    const name = displayMatch[1].trim()
      .replace(/\b(no.?reply|noreply|careers?|recruiting?|talent|hr|jobs?|hiring|acquisition|system|alert|notification|team|do.not.reply)\b/gi, '')
      .replace(/[^a-zA-Z0-9\s&.-]/g, '')
      .trim();
    if (name.length > 2 && name.length < 60) return name;
  }
  const emailMatch = from.match(/@([^>]+)/);
  if (emailMatch?.[1]) {
    const fullDomain = emailMatch[1].toLowerCase().replace(/[>\s]/g, '');
    const cleaned = fullDomain
      .replace(/^(mail|email|careers?|jobs?|notifications?|alerts?|no-?reply|noreply|auto|reply)\./i, '');
    const parts = cleaned.split('.');
    const companyPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (!companyPart) return undefined;
    if (!JOB_PLATFORMS.some(p => companyPart.toLowerCase().includes(p))) {
      return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
    }
  }
  return undefined;
}

function extractJobTitle(subject: string): string | undefined {
  const patterns = [
    /(?:applying for|application for|applied for|position of|role of|interest in the)\s*[""']?([^""',\n]{3,60}?)(?:[""']|\s+at\s|\s+@\s|$)/i,
    /(?:for the\s+)([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Analyst|Manager|Designer|Intern|Associate|Consultant|Specialist|Executive|Officer|Lead|Architect)[^,\n]{0,30})/i,
    /([A-Z][a-zA-Z\s]{2,}(?:Engineer|Developer|Analyst|Manager|Designer|Intern|Associate|Consultant|Specialist|Executive|Officer|Lead|Architect))/,
  ];
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match?.[1]) {
      const title = match[1].trim().replace(/\s+/g, ' ');
      if (title.length > 3 && title.length < 80) return title;
    }
  }
  return undefined;
}

router.post('/migrate-emails', (async (_req: Request, res: Response) => {
  try {
    // Get all recruitment/interview/offer emails that have no applicationId
    const emails = await EmailSyncModel.find({
      classification: { $in: ['recruitment', 'interview', 'offer'] },
      applicationId: { $exists: false },
      confidence: { $gte: 0.65 },
    }).sort({ receivedAt: 1 });

    logger.info(`Migration: found ${emails.length} unmatched job emails`);

    let created = 0;
    let skipped = 0;

    for (const email of emails) {
      try {
        const userId = email.userId.toString();
        const from = email.from;

        // Block job platforms
        if (JOB_PLATFORMS.some(p => from.toLowerCase().includes(p))) {
          skipped++;
          continue;
        }

        // Extract company and job title
        const company = extractCompany(from);
        const jobTitle = extractJobTitle(email.subject) ?? 'Position';

        if (!company || company.length < 2) {
          skipped++;
          continue;
        }

        // Check if application already exists for this company
        const existing = await applicationRepository.findByUserId(
          userId, {}, { page: 1, limit: 200, sortBy: 'appliedDate', sortOrder: 'desc' }
        );
        const alreadyExists = existing.data.some(
          (a: { company: string }) => a.company.toLowerCase().includes(company.toLowerCase()) ||
                 company.toLowerCase().includes(a.company.toLowerCase())
        );

        if (alreadyExists) {
          skipped++;
          continue;
        }

        // Create application
        const newApp = await applicationRepository.create(userId, {
          company,
          jobTitle,
          status: 'Applied',
          source: 'Other',
          appliedDate: email.receivedAt,
          notes: `Auto-created from email: "${email.subject}"\nSender: ${from}`,
        });

        // Link email to application
        await EmailSyncModel.findByIdAndUpdate(email._id, {
          applicationId: new Types.ObjectId(newApp._id.toString()),
        });

        // Notify
        await notificationRepository.create({
          userId,
          title: `Application auto-created: ${company}`,
          message: `Email about ${jobTitle} at ${company} was added to your applications.`,
          type: 'application_update',
          applicationId: newApp._id.toString(),
        });

        created++;
        logger.info(`Migration: created application for ${company} - ${jobTitle}`);
      } catch (err) {
        logger.warn(`Migration: failed for email "${email.subject}":`, err);
        skipped++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Migration complete: ${created} applications created, ${skipped} skipped`,
      data: { created, skipped, total: emails.length },
    });
  } catch (error) {
    logger.error('Migration failed:', error);
    res.status(500).json({ success: false, message: 'Migration failed' });
  }
}) as RequestHandler);

export default router;
