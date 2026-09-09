import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { setCache, getCache } from '../database/redis';
import {
  EmailClassificationType,
  EmailCategory,
  EmailClassificationResult,
  ProcessingMethod,
} from '../types';

// ─── AI Response Schema ───────────────────────────────────────────────────────
interface AIEmailResponse {
  isJobRelated: boolean;
  category: EmailCategory;
  company: string | null;
  jobTitle: string | null;
  status: string | null;
  confidence: number; // 0-100
  importantDates: Record<string, string>;
  recruiterName: string | null;
  recruiterEmail: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  location: string | null;
  requiredAction: string | null;
  summary: string;
}

// ─── Category → Classification mapping ───────────────────────────────────────
const CATEGORY_TO_CLASSIFICATION: Record<EmailCategory, EmailClassificationType> = {
  application_received: 'recruitment',
  application_viewed: 'recruitment',
  shortlisted: 'recruitment',
  assessment_sent: 'interview',
  assessment_completed: 'interview',
  phone_screen_scheduled: 'interview',
  phone_screen_completed: 'interview',
  technical_interview_scheduled: 'interview',
  technical_interview_completed: 'interview',
  onsite_interview_scheduled: 'interview',
  onsite_interview_completed: 'interview',
  offer_extended: 'offer',
  offer_accepted: 'offer',
  rejection: 'rejection',
  follow_up: 'follow_up',
  unknown: 'recruitment',
};

// ─── Status mapping ───────────────────────────────────────────────────────────
const VALID_STATUSES = [
  'Applied', 'Shortlisted', 'Interview Scheduled', 'Interview Completed',
  'Offer', 'Rejected', 'Withdrawn',
];

function sanitizeStatus(status: string | null): string | undefined {
  if (!status) return undefined;
  // Map AI status values to our application statuses
  const mapping: Record<string, string> = {
    'Applied': 'Applied',
    'Shortlisted': 'Shortlisted',
    'Phone Screen': 'Interview Scheduled',
    'Assessment': 'Interview Scheduled',
    'Interview Scheduled': 'Interview Scheduled',
    'Interview Completed': 'Interview Completed',
    'Offer': 'Offer',
    'Offer Received': 'Offer',
    'Selected': 'Offer',
    'Negotiating': 'Offer',
    'Accepted': 'Offer',
    'Rejected': 'Rejected',
    'Withdrawn': 'Withdrawn',
    'HR Round': 'Interview Scheduled',
  };
  return mapping[status] ?? (VALID_STATUSES.includes(status) ? status : undefined);
}

// ─── Cache key ────────────────────────────────────────────────────────────────
function buildCacheKey(subject: string, from: string, snippet: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${subject}|${from}|${snippet}`)
    .digest('hex');
  return `ai_email:${hash}`;
}

// ─── Schema validation ────────────────────────────────────────────────────────
const VALID_CATEGORIES: EmailCategory[] = [
  'application_received', 'application_viewed', 'shortlisted',
  'assessment_sent', 'assessment_completed',
  'phone_screen_scheduled', 'phone_screen_completed',
  'technical_interview_scheduled', 'technical_interview_completed',
  'onsite_interview_scheduled', 'onsite_interview_completed',
  'offer_extended', 'offer_accepted', 'rejection', 'follow_up', 'unknown',
];

function validateAIResponse(data: unknown): data is AIEmailResponse {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;

  if (typeof r['isJobRelated'] !== 'boolean') return false;
  if (!VALID_CATEGORIES.includes(r['category'] as EmailCategory)) return false;
  if (typeof r['confidence'] !== 'number') return false;
  if (r['confidence'] < 0 || r['confidence'] > 100) return false;
  if (typeof r['summary'] !== 'string') return false;

  return true;
}

// ─── AI System Prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert email classifier for a job application tracking system.

Analyze the given email and return ONLY valid JSON matching this exact schema:
{
  "isJobRelated": boolean,
  "category": one of [application_received, application_viewed, shortlisted, assessment_sent, assessment_completed, phone_screen_scheduled, phone_screen_completed, technical_interview_scheduled, technical_interview_completed, onsite_interview_scheduled, onsite_interview_completed, offer_extended, offer_accepted, rejection, follow_up, unknown],
  "company": string | null,
  "jobTitle": string | null,
  "status": one of [Applied, Shortlisted, Phone Screen, Assessment, Interview Scheduled, Interview Completed, Offer, Negotiating, Accepted, Rejected, Withdrawn] | null,
  "confidence": integer 0-100,
  "importantDates": object with keys like "interview", "deadline", "joiningDate", "offerExpiry" and ISO date string values,
  "recruiterName": string | null,
  "recruiterEmail": string | null,
  "salaryMin": number | null,
  "salaryMax": number | null,
  "salaryCurrency": string | null,
  "location": string | null,
  "requiredAction": string | null,
  "summary": string (1-2 sentences)
}

Rules:
- NEVER hallucinate company names, job titles, or dates not present in the email
- Return null for any field not clearly present in the email
- confidence reflects how certain you are about the classification (100 = absolutely certain)
- isJobRelated = false for: job alerts/recommendations (e.g. "25 new jobs for you"), LinkedIn connection invitations, "someone viewed your profile", newsletters, promotions, digests, account alerts, and marketing emails
- isJobRelated = true ONLY for emails about a SPECIFIC application the person actually submitted: application confirmations, interview invites, assessments, offers, rejections from a company the user applied to
- A job alert listing multiple jobs is NOT a job application — set isJobRelated = false
- Set status to null unless the email clearly indicates a status change for a specific application the user submitted
- For job alerts, recommendations, and invitations, set confidence low (below 40) and status to null
- Return ONLY the JSON object, no markdown, no explanation`;

export class AIEmailAnalyzerService {
  private isAvailable: boolean = true;
  // Rate limiter: max 10 requests per minute (free tier = 15/min, keep buffer)
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 10;

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      // Wait until oldest request is > 1 minute old
      const oldestRequest = this.requestTimestamps[0]!;
      const waitMs = oldestRequest + 60 * 1000 - now + 100;
      if (waitMs > 0) {
        logger.info(`Gemini rate limit: waiting ${Math.round(waitMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
    this.requestTimestamps.push(Date.now());
  }

  async analyze(
    subject: string,
    from: string,
    snippet: string
  ): Promise<{ result: AIEmailResponse; method: ProcessingMethod; cached: boolean } | null> {
    // Check if Gemini is configured
    if (!config.openai.apiKey) {
      logger.warn('Gemini API key not configured — AI analysis disabled');
      this.isAvailable = false;
      return null;
    }

    // Check cache first
    const cacheKey = buildCacheKey(subject, from, snippet);
    try {
      const cached = await getCache<AIEmailResponse>(cacheKey);
      if (cached) {
        logger.info(`AI cache hit for email: "${subject.slice(0, 50)}"`);
        return { result: cached, method: 'ai', cached: true };
      }
    } catch {
      // Cache failure is non-critical
    }

    // Call Gemini via REST API (works with all key formats including AQ. prefix)
    try {
      const userPrompt = `Subject: ${subject}\nFrom: ${from}\nPreview: ${snippet}`;
      const prompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

      // Wait for rate limit before calling
      await this.waitForRateLimit();

      const callGemini = async () => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${config.openai.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 500,
            },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      let response = await callGemini();

      // Retry once on 429 after waiting 60 seconds
      if (response.status === 429) {
        logger.warn('Gemini 429 rate limit hit — waiting 60s before retry');
        await new Promise(resolve => setTimeout(resolve, 60000));
        this.requestTimestamps = []; // Reset rate limit tracker
        response = await callGemini();
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Empty Gemini response');

      const parsed = JSON.parse(content) as unknown;

      if (!validateAIResponse(parsed)) {
        throw new Error('Gemini response failed schema validation');
      }

      // Cache the result for 24 hours
      try {
        await setCache(cacheKey, parsed, 24 * 60 * 60);
      } catch {
        // Cache failure is non-critical
      }

      this.isAvailable = true;
      logger.info(`Gemini classified "${subject.slice(0, 50)}" as ${parsed.category} (${parsed.confidence}% confidence)`);

      return { result: parsed, method: 'ai', cached: false };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Gemini analysis failed: ${errMsg}`);
      this.isAvailable = false;
      return null;
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable && !!config.openai.apiKey;
  }

  // Convert AI response to our EmailClassificationResult format
  toClassificationResult(
    ai: AIEmailResponse,
    applicationId?: string,
    method: ProcessingMethod = 'ai'
  ): EmailClassificationResult {
    const classification = CATEGORY_TO_CLASSIFICATION[ai.category] ?? 'recruitment';
    const confidenceNormalized = ai.confidence / 100;
    const isPendingReview = confidenceNormalized < 0.5 && ai.isJobRelated;

    return {
      classification: ai.isJobRelated ? classification : 'unrelated',
      category: ai.category,
      confidence: confidenceNormalized,
      applicationId,
      suggestedStatus: sanitizeStatus(ai.status),
      processingMethod: method,
      recruiterName: ai.recruiterName ?? undefined,
      recruiterEmail: ai.recruiterEmail ?? undefined,
      salaryMin: ai.salaryMin ?? undefined,
      salaryMax: ai.salaryMax ?? undefined,
      salaryCurrency: ai.salaryCurrency ?? undefined,
      location: ai.location ?? undefined,
      requiredAction: ai.requiredAction ?? undefined,
      summary: ai.summary,
      importantDates: Object.keys(ai.importantDates).length > 0 ? ai.importantDates : undefined,
      isPendingReview,
      aiCompany: ai.company ?? undefined,
      aiJobTitle: ai.jobTitle ?? undefined,
    };
  }
}

export const aiEmailAnalyzerService = new AIEmailAnalyzerService();
