import { applicationRepository } from '../repositories/application.repository';
import { EmailClassificationResult, EmailClassificationType } from '../types';
import { logger } from '../utils/logger';

// Keywords for classification
const RECRUITMENT_KEYWORDS = [
  'application received', 'thank you for applying', 'we received your application',
  'position', 'role', 'job opportunity', 'career', 'hiring',
  'talent acquisition', 'recruitment', 'recruiter',
];

const INTERVIEW_KEYWORDS = [
  'interview', 'schedule', 'meeting', 'call', 'zoom', 'teams',
  'availability', 'time slot', 'phone screen', 'technical round',
  'on-site', 'virtual interview', 'panel',
];

const OFFER_KEYWORDS = [
  'offer letter', 'congratulations', 'pleased to offer', 'job offer',
  'compensation', 'salary', 'start date', 'welcome aboard',
  'package', 'benefits',
];

const REJECTION_KEYWORDS = [
  'unfortunately', 'not moving forward', 'decided not to proceed',
  'other candidates', 'not selected', 'regret to inform',
  'wish you the best', 'not a fit', 'position has been filled',
];

const FOLLOW_UP_KEYWORDS = [
  'follow up', 'following up', 'checking in', 'update on',
  'status of', 'next steps', 'timeline', 'hear back',
];

// Common recruitment sender domains
const RECRUITMENT_DOMAINS = [
  'linkedin.com', 'greenhouse.io', 'lever.co', 'workday.com',
  'smartrecruiters.com', 'ashbyhq.com', 'jobvite.com',
  'icims.com', 'taleo.net', 'bamboohr.com',
];

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

function isRecruitmentDomain(email: string): boolean {
  return RECRUITMENT_DOMAINS.some((domain) =>
    email.toLowerCase().includes(domain)
  );
}

function classifyEmail(
  subject: string,
  snippet: string,
  from: string
): { classification: EmailClassificationType; confidence: number } {
  const text = `${subject} ${snippet}`;

  const scores = {
    recruitment: countKeywordMatches(text, RECRUITMENT_KEYWORDS),
    interview: countKeywordMatches(text, INTERVIEW_KEYWORDS),
    offer: countKeywordMatches(text, OFFER_KEYWORDS),
    rejection: countKeywordMatches(text, REJECTION_KEYWORDS),
    follow_up: countKeywordMatches(text, FOLLOW_UP_KEYWORDS),
  };

  // Bonus for recruitment domains
  if (isRecruitmentDomain(from)) {
    scores.recruitment += 2;
  }

  const maxScore = Math.max(...Object.values(scores));
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // If no keywords match, it's unrelated
  if (maxScore === 0) {
    return { classification: 'unrelated', confidence: 0.9 };
  }

  // Find the winning classification
  const entries = Object.entries(scores) as [EmailClassificationType, number][];
  const winner = entries.reduce((best, current) =>
    current[1] > best[1] ? current : best
  );

  // Calculate confidence based on how dominant the winner is
  const confidence = totalScore > 0
    ? Math.min(0.95, 0.4 + (winner[1] / totalScore) * 0.5 + (maxScore / 5) * 0.1)
    : 0.5;

  return {
    classification: winner[0],
    confidence: Math.round(confidence * 100) / 100,
  };
}

function mapClassificationToStatus(
  classification: EmailClassificationType
): string | undefined {
  switch (classification) {
    case 'interview':
      return 'Interview Scheduled';
    case 'offer':
      return 'Offer';
    case 'rejection':
      return 'Rejected';
    default:
      return undefined;
  }
}

export class EmailClassifierService {
  async classify(
    userId: string,
    subject: string,
    snippet: string,
    from: string
  ): Promise<EmailClassificationResult> {
    const { classification, confidence } = classifyEmail(subject, snippet, from);

    // Skip application matching for unrelated emails
    if (classification === 'unrelated') {
      return { classification, confidence };
    }

    // Try to match with an existing application
    const matchedApp = await this.matchToApplication(userId, subject, snippet, from);
    const suggestedStatus = mapClassificationToStatus(classification);

    return {
      classification,
      confidence,
      applicationId: matchedApp ?? undefined,
      suggestedStatus,
    };
  }

  private async matchToApplication(
    userId: string,
    subject: string,
    snippet: string,
    from: string
  ): Promise<string | null> {
    try {
      // Get user's applications
      const { data: applications } = await applicationRepository.findByUserId(
        userId,
        {},
        { page: 1, limit: 50, sortBy: 'appliedDate', sortOrder: 'desc' }
      );

      if (applications.length === 0) return null;

      const text = `${subject} ${snippet} ${from}`.toLowerCase();

      // Try to match by company name
      for (const app of applications) {
        const companyLower = app.company.toLowerCase();
        if (text.includes(companyLower)) {
          return app._id.toString();
        }
      }

      // Try to match by job title keywords
      for (const app of applications) {
        const titleWords = app.jobTitle.toLowerCase().split(/\s+/);
        const significantWords = titleWords.filter((w) => w.length > 3);
        const matches = significantWords.filter((w) => text.includes(w));
        if (matches.length >= 2) {
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
