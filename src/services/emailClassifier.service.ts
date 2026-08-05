import crypto from 'crypto';
import { applicationRepository } from '../repositories/application.repository';
import { EmailSyncModel } from '../models';
import { EmailClassificationResult, EmailClassificationType, ProcessingMethod } from '../types';
import { logger } from '../utils/logger';
import { aiEmailAnalyzerService } from './aiEmailAnalyzer.service';

// ─── Stage 1: Pre-Filter ──────────────────────────────────────────────────────
// Fast synchronous check — runs in <50ms, no AI cost

const JOB_KEYWORDS = [
  'application', 'interview', 'offer', 'rejection', 'position', 'role',
  'job', 'career', 'hiring', 'recruiter', 'recruitment', 'talent',
  'shortlisted', 'selected', 'assessment', 'resume', 'cv', 'candidate',
  'opportunity', 'vacancy', 'opening', 'placement', 'employment',
  'congratulations', 'unfortunately', 'background check', 'onboarding',
  'start date', 'salary', 'compensation', 'offer letter',
];

const RECRUITMENT_DOMAINS = [
  'greenhouse.io', 'lever.co', 'workday.com', 'smartrecruiters.com',
  'ashbyhq.com', 'jobvite.com', 'icims.com', 'taleo.net', 'bamboohr.com',
  'breezy.hr', 'recruitee.com', 'jazz.co', 'linkedin.com', 'indeed.com',
  'glassdoor.com', 'naukri.com', 'monster.com', 'ziprecruiter.com',
  'wellfound.com', 'hired.com', 'angellist.com', 'careers-page.com',
  'successfactors.com', 'oracle.com', 'workdayjobs.com',
];

function passesPreFilter(subject: string, from: string, snippet: string): boolean {
  const text = `${subject} ${snippet}`.toLowerCase();
  const fromLower = from.toLowerCase();

  // Check known recruitment domains (fast exit)
  if (RECRUITMENT_DOMAINS.some((d) => fromLower.includes(d))) return true;

  // Check keywords
  return JOB_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── Stage 2b: Fallback Rule-Based Classifier ────────────────────────────────

const WEIGHTED_KEYWORDS: Record<EmailClassificationType, Array<[string, number]>> = {
  interview: [
    ['interview invitation', 3], ['interview scheduled', 3], ['schedule an interview', 3],
    ['technical interview', 3], ['phone screen', 3], ['video interview', 3],
    ['availability for', 2], ['select a time', 2], ['calendly', 2], ['zoom link', 2],
    ['google meet', 2], ['microsoft teams', 2], ['on-site interview', 2],
    ['coding interview', 2], ['technical assessment', 2], ['technical round', 2],
    ['interview', 1], ['availability', 1], ['schedule', 1], ['hr round', 1],
    ['screening call', 1], ['next steps', 1],
  ],
  offer: [
    ['offer letter', 3], ['job offer', 3], ['pleased to offer', 3],
    ['offer of employment', 3], ['compensation package', 3], ['sign-on bonus', 3],
    ['congratulations', 2], ['welcome to the team', 2], ['start date', 2],
    ['annual salary', 2], ['base salary', 2], ['equity', 2], ['stock options', 2],
    ['accept the offer', 2], ['background check', 2],
    ['offer', 1], ['welcome aboard', 1], ['onboarding', 1],
  ],
  rejection: [
    ['unfortunately', 3], ['not moving forward', 3], ['decided not to proceed', 3],
    ['not selected', 3], ['other candidates', 3], ['position has been filled', 3],
    ['regret to inform', 2], ['not a match', 2], ['pursue other candidates', 2],
    ['wish you the best', 2], ['not the right fit', 2],
    ['regret', 1], ['declined', 1], ['appreciate your time', 1],
  ],
  recruitment: [
    ['application received', 3], ['thank you for applying', 3],
    ['we received your application', 3], ['application confirmation', 3],
    ['shortlisted', 2], ['under review', 2], ['talent acquisition', 2],
    ['recruitment team', 2], ['hiring manager', 2],
    ['position', 1], ['role', 1], ['hiring', 1], ['recruiter', 1],
  ],
  follow_up: [
    ['following up on my application', 3], ['checking in on', 3],
    ['update on my application', 3],
    ['following up', 2], ['any updates', 2], ['hear back', 2],
    ['follow up', 1], ['checking in', 1], ['touch base', 1],
  ],
  unrelated: [],
};

function ruleBased(
  subject: string,
  snippet: string,
  from: string
): { classification: EmailClassificationType; confidence: number } {
  const text = `${subject} ${snippet}`.toLowerCase();
  const fromLower = from.toLowerCase();

  const scores: Record<EmailClassificationType, number> = {
    recruitment: 0, interview: 0, offer: 0, rejection: 0, follow_up: 0, unrelated: 0,
  };

  for (const [type, keywords] of Object.entries(WEIGHTED_KEYWORDS) as [EmailClassificationType, Array<[string, number]>][]) {
    for (const [kw, w] of keywords) {
      if (text.includes(kw)) scores[type] += w;
    }
  }

  // Bonus for recruitment domains
  if (RECRUITMENT_DOMAINS.some((d) => fromLower.includes(d))) scores.recruitment += 3;

  const entries = Object.entries(scores) as [EmailClassificationType, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) return { classification: 'unrelated', confidence: 0.9 };

  entries.sort(([, a], [, b]) => b - a);
  const winner = entries[0]![0];
  const top = entries[0]![1];
  const second = entries[1]?.[1] ?? 0;

  if (top < 2) return { classification: 'unrelated', confidence: 0.85 };

  const dominance = second > 0 ? top / (top + second) : 1;
  const confidence = Math.min(0.92, 0.4 + dominance * 0.45 + Math.min(top / 15, 0.07));

  return { classification: winner!, confidence: Math.round(confidence * 100) / 100 };
}

function ruleBasedStatus(classification: EmailClassificationType): string | undefined {
  switch (classification) {
    case 'interview': return 'Interview Scheduled';
    case 'offer': return 'Offer';
    case 'rejection': return 'Rejected';
    case 'recruitment': return 'Shortlisted';
    default: return undefined;
  }
}

// ─── Application Matcher ──────────────────────────────────────────────────────
async function matchToApplication(
  userId: string,
  subject: string,
  snippet: string,
  from: string,
  threadId?: string,
  recruiterEmail?: string,
  company?: string | null,
  jobTitle?: string | null
): Promise<string | null> {
  try {
    const { data: apps } = await applicationRepository.findByUserId(
      userId,
      { isArchived: false },
      { page: 1, limit: 100, sortBy: 'appliedDate', sortOrder: 'desc' }
    );

    if (apps.length === 0) return null;

    // Priority 1: Thread ID match
    if (threadId) {
      const threadMatch = await EmailSyncModel.findOne({
        userId,
        threadId,
        applicationId: { $exists: true, $ne: null },
      }).sort({ receivedAt: -1 });

      if (threadMatch?.applicationId) {
        const appId = threadMatch.applicationId.toString();
        if (apps.some((a) => a._id.toString() === appId)) {
          logger.info(`Matched email via thread ID`);
          return appId;
        }
      }
    }

    // Priority 2: Recruiter email match
    if (recruiterEmail) {
      const re = recruiterEmail.toLowerCase();
      const recMatch = apps.find((a) =>
        a.notes?.toLowerCase().includes(re)
      );
      if (recMatch) {
        logger.info(`Matched email via recruiter email`);
        return recMatch._id.toString();
      }
    }

    // Priority 3: AI-extracted company name
    if (company && company.length > 2) {
      const compLower = company.toLowerCase();
      const match = apps.find((a) => a.company.toLowerCase() === compLower);
      if (match) {
        logger.info(`Matched email via AI-extracted company: "${company}"`);
        return match._id.toString();
      }
      // Partial match
      const partial = apps.find((a) => {
        const ac = a.company.toLowerCase();
        return ac.includes(compLower) || compLower.includes(ac);
      });
      if (partial) {
        logger.info(`Matched email via partial company name: "${company}"`);
        return partial._id.toString();
      }
    }

    // Priority 4: Text-based company name from email
    const text = `${subject} ${snippet} ${from}`.toLowerCase();
    for (const app of apps) {
      const c = app.company.toLowerCase();
      if (c.length > 2 && text.includes(c)) {
        logger.info(`Matched email via text company: "${app.company}"`);
        return app._id.toString();
      }
    }

    // Priority 4b: Sender domain vs company
    const senderDomain = from.toLowerCase().replace(/.*@/, '').replace(/>.*/, '').split('.')[0] ?? '';
    if (senderDomain.length > 2) {
      for (const app of apps) {
        const c = app.company.toLowerCase().replace(/[^a-z0-9]/g, '');
        const d = senderDomain.replace(/[^a-z0-9]/g, '');
        if (d.includes(c) || c.includes(d)) {
          logger.info(`Matched email via sender domain: "${app.company}"`);
          return app._id.toString();
        }
      }
    }

    // Priority 5: AI job title + company combo
    if (jobTitle && jobTitle.length > 3) {
      const words = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      for (const app of apps) {
        const appWords = app.jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const matches = words.filter((w) => appWords.includes(w));
        if (matches.length >= 2) {
          logger.info(`Matched email via job title keywords`);
          return app._id.toString();
        }
      }
    }

    return null;
  } catch (error) {
    logger.warn('Application matching failed:', error);
    return null;
  }
}

// ─── Deduplication key ────────────────────────────────────────────────────────
export function buildEmailHash(subject: string, from: string): string {
  return crypto.createHash('sha256').update(`${subject}|${from}`).digest('hex').slice(0, 16);
}

// ─── Main Classifier ──────────────────────────────────────────────────────────
export class EmailClassifierService {
  async classify(
    userId: string,
    subject: string,
    snippet: string,
    from: string,
    threadId?: string
  ): Promise<EmailClassificationResult> {
    // ── Stage 1: Pre-Filter ──────────────────────────────────────────────────
    const start = Date.now();
    const passes = passesPreFilter(subject, from, snippet);
    const preFilterMs = Date.now() - start;

    if (preFilterMs > 50) {
      logger.warn(`Pre-filter took ${preFilterMs}ms (target: 50ms)`);
    }

    if (!passes) {
      return {
        classification: 'unrelated',
        confidence: 0.95,
        processingMethod: 'pre_filter',
      };
    }

    // ── Stage 2a: AI Analysis ────────────────────────────────────────────────
    let processingMethod: ProcessingMethod = 'ai';
    let fallbackReason: string | undefined;

    const aiResult = await aiEmailAnalyzerService.analyze(subject, from, snippet);

    if (aiResult) {
      const { result: ai, cached } = aiResult;

      // Not job related per AI
      if (!ai.isJobRelated) {
        return {
          classification: 'unrelated',
          confidence: ai.confidence / 100,
          processingMethod: 'ai',
          summary: ai.summary,
        };
      }

      // Match to application using AI-extracted data
      const applicationId = await matchToApplication(
        userId, subject, snippet, from, threadId,
        ai.recruiterEmail ?? undefined,
        ai.company,
        ai.jobTitle
      );

      const result = aiEmailAnalyzerService.toClassificationResult(ai, applicationId ?? undefined, 'ai');

      if (cached) logger.info(`Used cached AI result for "${subject.slice(0, 40)}"`);

      return result;
    }

    // ── Stage 2b: Fallback Rule-Based ────────────────────────────────────────
    fallbackReason = 'AI unavailable or returned invalid response';
    processingMethod = 'rule_based';

    logger.info(`Using rule-based fallback for "${subject.slice(0, 40)}"`);

    const { classification, confidence } = ruleBased(subject, snippet, from);

    if (classification === 'unrelated') {
      return {
        classification: 'unrelated',
        confidence,
        processingMethod,
        fallbackReason,
      };
    }

    const applicationId = await matchToApplication(
      userId, subject, snippet, from, threadId
    );

    return {
      classification,
      confidence,
      applicationId: applicationId ?? undefined,
      suggestedStatus: ruleBasedStatus(classification),
      processingMethod,
      fallbackReason,
      isPendingReview: confidence < 0.5,
    };
  }
}

export const emailClassifierService = new EmailClassifierService();
