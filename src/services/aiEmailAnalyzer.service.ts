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
- isJobRelated = false for newsletters, promotions, account alerts, and non-recruitment emails
- Return ONLY the JSON object, no markdown, no explanation`;

export class AIEmailAnalyzerService {
  private isAvailable: boolean = true;

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

    // Call Gemini
    try {
      const userPrompt = `Subject: ${subject}\nFrom: ${from}\nPreview: ${snippet}`;

      // Dynamic import to avoid crash if package not installed yet
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(config.openai.apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 500,
        },
      });

      const prompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
      const result = await model.generateContent(prompt);
      const content = result.response.text();

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
