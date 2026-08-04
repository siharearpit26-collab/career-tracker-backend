import { applicationRepository } from '../repositories/application.repository';
import { EmailClassificationResult, EmailClassificationType } from '../types';
import { logger } from '../utils/logger';

// ─── Weighted keyword definitions ───────────────────────────────────────────
// Each keyword has a weight (1 = normal, 2 = strong signal, 3 = very strong)

const WEIGHTED_KEYWORDS: Record<EmailClassificationType, Array<[string, number]>> = {
  interview: [
    // Very strong signals
    ['interview invitation', 3],
    ['interview scheduled', 3],
    ['schedule an interview', 3],
    ['invite you for an interview', 3],
    ['invited to interview', 3],
    ['technical interview', 3],
    ['phone screen', 3],
    ['video interview', 3],
    // Strong signals
    ['availability for', 2],
    ['select a time', 2],
    ['schedule a call', 2],
    ['calendly', 2],
    ['zoom link', 2],
    ['google meet', 2],
    ['microsoft teams', 2],
    ['on-site interview', 2],
    ['panel interview', 2],
    ['coding interview', 2],
    ['technical assessment', 2],
    ['take-home assignment', 2],
    ['technical round', 2],
    ['interview process', 2],
    // Normal signals
    ['interview', 1],
    ['availability', 1],
    ['schedule', 1],
    ['hr round', 1],
    ['screening call', 1],
    ['introductory call', 1],
    ['next steps', 1],
  ],

  offer: [
    // Very strong signals
    ['offer letter', 3],
    ['job offer', 3],
    ['pleased to offer', 3],
    ['we are offering', 3],
    ['offer of employment', 3],
    ['compensation package', 3],
    ['sign-on bonus', 3],
    // Strong signals
    ['congratulations', 2],
    ['welcome to the team', 2],
    ['start date', 2],
    ['salary of', 2],
    ['annual salary', 2],
    ['base salary', 2],
    ['equity', 2],
    ['stock options', 2],
    ['benefits package', 2],
    ['accept the offer', 2],
    ['background check', 2],
    // Normal signals
    ['offer', 1],
    ['welcome aboard', 1],
    ['joining us', 1],
    ['onboarding', 1],
  ],

  rejection: [
    // Very strong signals
    ['unfortunately', 3],
    ['not moving forward', 3],
    ['decided not to proceed', 3],
    ['will not be moving forward', 3],
    ['not selected', 3],
    ['not be continuing', 3],
    ['other candidates', 3],
    ['position has been filled', 3],
    // Strong signals
    ['regret to inform', 2],
    ['difficult decision', 2],
    ['not a match', 2],
    ['does not meet', 2],
    ['pursue other candidates', 2],
    ['wish you the best', 2],
    ['keep your resume on file', 2],
    ['future opportunities', 2],
    ['not the right fit', 2],
    // Normal signals
    ['regret', 1],
    ['declined', 1],
    ['not successful', 1],
    ['thank you for your interest', 1],
    ['appreciate your time', 1],
  ],

  recruitment: [
    // Very strong signals
    ['application received', 3],
    ['thank you for applying', 3],
    ['we received your application', 3],
    ['your application has been submitted', 3],
    ['application confirmation', 3],
    ['successfully applied', 3],
    // Strong signals
    ['shortlisted', 2],
    ['under review', 2],
    ['application is being reviewed', 2],
    ['talent acquisition', 2],
    ['we are reviewing', 2],
    ['recruitment team', 2],
    ['hiring manager', 2],
    ['job application', 2],
    ['applied for the position', 2],
    // Normal signals
    ['position', 1],
    ['role', 1],
    ['hiring', 1],
    ['recruiter', 1],
    ['career', 1],
    ['opportunity', 1],
    ['we found your profile', 1],
    ['your background', 1],
    ['job opening', 1],
  ],

  follow_up: [
    // Very strong signals
    ['following up on my application', 3],
    ['checking in on', 3],
    ['update on my application', 3],
    ['wanted to follow up', 3],
    // Strong signals
    ['following up', 2],
    ['any updates', 2],
    ['still interested', 2],
    ['hear back', 2],
    ['timeline for', 2],
    ['status of my application', 2],
    // Normal signals
    ['follow up', 1],
    ['checking in', 1],
    ['update', 1],
    ['touch base', 1],
    ['next steps', 1],
  ],

  unrelated: [],
};

// Known recruitment platform domains with high confidence
const RECRUITMENT_DOMAINS: Record<string, number> = {
  'greenhouse.io': 3,
  'lever.co': 3,
  'workday.com': 3,
  'smartrecruiters.com': 3,
  'ashbyhq.com': 3,
  'jobvite.com': 3,
  'icims.com': 3,
  'taleo.net': 3,
  'bamboohr.com': 3,
  'breezy.hr': 3,
  'recruitee.com': 3,
  'jazz.co': 3,
  'linkedin.com': 2,
  'indeed.com': 2,
  'glassdoor.com': 2,
  'naukri.com': 2,
  'monster.com': 2,
  'ziprecruiter.com': 2,
  'dice.com': 2,
  'hired.com': 2,
  'angellist.com': 2,
  'wellfound.com': 2,
  'careers-page.com': 2,
};

// Common recruitment email subjects
const SUBJECT_PATTERNS: Array<[RegExp, EmailClassificationType, number]> = [
  [/your application (for|to)/i, 'recruitment', 2],
  [/application (received|confirmation|submitted)/i, 'recruitment', 3],
  [/interview (invitation|request|scheduled|confirmed)/i, 'interview', 3],
  [/technical (interview|assessment|round|test)/i, 'interview', 3],
  [/offer (letter|of employment)/i, 'offer', 3],
  [/congratulations.*offer/i, 'offer', 3],
  [/unfortunately|regret to inform/i, 'rejection', 3],
  [/not.*moving forward|not.*selected/i, 'rejection', 3],
  [/following up|checking in/i, 'follow_up', 2],
  [/(software|frontend|backend|fullstack|full.stack) engineer/i, 'recruitment', 1],
  [/(developer|engineer|analyst|designer|manager) (role|position|opportunity)/i, 'recruitment', 1],
];

function calculateScores(
  subject: string,
  snippet: string,
  from: string
): Record<EmailClassificationType, number> {
  const text = `${subject} ${snippet}`.toLowerCase();
  const fromLower = from.toLowerCase();

  const scores: Record<EmailClassificationType, number> = {
    recruitment: 0,
    interview: 0,
    offer: 0,
    rejection: 0,
    follow_up: 0,
    unrelated: 0,
  };

  // Score from weighted keywords
  for (const [type, keywords] of Object.entries(WEIGHTED_KEYWORDS) as [EmailClassificationType, Array<[string, number]>][]) {
    for (const [keyword, weight] of keywords) {
      if (text.includes(keyword)) {
        scores[type] += weight;
      }
    }
  }

  // Score from subject line patterns (subject gets 2x weight)
  const subjectLower = subject.toLowerCase();
  for (const [pattern, type, weight] of SUBJECT_PATTERNS) {
    if (pattern.test(subjectLower)) {
      scores[type] += weight * 2;
    }
  }

  // Score from sender domain
  for (const [domain, weight] of Object.entries(RECRUITMENT_DOMAINS)) {
    if (fromLower.includes(domain)) {
      scores.recruitment += weight;
    }
  }

  return scores;
}

function selectClassification(
  scores: Record<EmailClassificationType, number>
): { classification: EmailClassificationType; confidence: number } {
  const entries = Object.entries(scores) as [EmailClassificationType, number][];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (total === 0) {
    return { classification: 'unrelated', confidence: 0.95 };
  }

  // Sort by score descending
  entries.sort(([, a], [, b]) => b - a);
  const winner = entries[0]![0];
  const topScore = entries[0]![1];
  const secondScore = entries[1]?.[1] ?? 0;

  // If top score is very low, it's unrelated
  if (topScore < 2) {
    return { classification: 'unrelated', confidence: 0.85 };
  }

  // Confidence = based on dominance of winner
  const dominance = secondScore > 0 ? topScore / (topScore + secondScore) : 1;
  const rawConfidence = 0.4 + dominance * 0.5 + Math.min(topScore / 15, 0.1);
  const confidence = Math.min(0.97, Math.round(rawConfidence * 100) / 100);

  return { classification: winner!, confidence };
}

function mapToStatus(classification: EmailClassificationType): string | undefined {
  switch (classification) {
    case 'interview': return 'Interview Scheduled';
    case 'offer': return 'Offer';
    case 'rejection': return 'Rejected';
    case 'recruitment': return 'Shortlisted';
    default: return undefined;
  }
}

export class EmailClassifierService {
  async classify(
    userId: string,
    subject: string,
    snippet: string,
    from: string
  ): Promise<EmailClassificationResult> {
    const scores = calculateScores(subject, snippet, from);
    const { classification, confidence } = selectClassification(scores);

    if (classification === 'unrelated') {
      return { classification, confidence };
    }

    // Try to match with an existing application
    const applicationId = await this.matchToApplication(userId, subject, snippet, from);
    const suggestedStatus = mapToStatus(classification);

    return { classification, confidence, applicationId: applicationId ?? undefined, suggestedStatus };
  }

  private async matchToApplication(
    userId: string,
    subject: string,
    snippet: string,
    from: string
  ): Promise<string | null> {
    try {
      const { data: applications } = await applicationRepository.findByUserId(
        userId,
        { isArchived: false },
        { page: 1, limit: 100, sortBy: 'appliedDate', sortOrder: 'desc' }
      );

      if (applications.length === 0) return null;

      const text = `${subject} ${snippet} ${from}`.toLowerCase();

      // Priority 1: Match by company name (exact or partial)
      for (const app of applications) {
        const company = app.company.toLowerCase();
        if (text.includes(company) && company.length > 2) {
          logger.info(`Email matched to application via company: "${app.company}"`);
          return app._id.toString();
        }
      }

      // Priority 2: Match by sender domain vs company name
      const senderDomain = from.toLowerCase().replace(/.*@/, '').replace(/>.*/, '').split('.')[0] ?? '';
      if (senderDomain.length > 2) {
        for (const app of applications) {
          const company = app.company.toLowerCase().replace(/[^a-z0-9]/g, '');
          const domain = senderDomain.replace(/[^a-z0-9]/g, '');
          if (domain.includes(company) || company.includes(domain)) {
            logger.info(`Email matched to application via domain: "${app.company}"`);
            return app._id.toString();
          }
        }
      }

      // Priority 3: Match by job title keywords (need 2+ significant word matches)
      for (const app of applications) {
        const titleWords = app.jobTitle
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !['with', 'that', 'this', 'from', 'have', 'your'].includes(w));

        const matches = titleWords.filter((w) => text.includes(w));
        if (matches.length >= 2) {
          logger.info(`Email matched to application via job title: "${app.jobTitle}"`);
          return app._id.toString();
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to match email to application:', error);
      return null;
    }
  }
}

export const emailClassifierService = new EmailClassifierService();
