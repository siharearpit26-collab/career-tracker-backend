import { ClassificationResult, PageType } from '../types';
import { logger } from '../../utils/logger';

// ─── Rule-Based Classification ────────────────────────────────────────────────

const JOB_PAGE_SIGNALS = {
  jsonLd: /"@type"\s*:\s*"JobPosting"/i,
  applyButton: /(apply now|apply for this|submit application|apply here)/i,
  jobFields: /(job description|responsibilities|requirements|qualifications|what you'll do)/i,
  salaryPattern: /(salary|compensation|pay range|₹|Rs\.|LPA|\$\d+[kK])/i,
  experiencePattern: /(\d+[-–]\d+ years?|experience required|years of experience)/i,
  locationField: /(job location|work location|office location|remote|hybrid|on-?site)/i,
  employmentType: /(full[- ]time|part[- ]time|contract|internship|freelance)/i,
};

const LISTING_PAGE_SIGNALS = {
  multipleJobs: /(\d+ (jobs?|positions?|openings?|vacancies))|((showing|found|results?) \d+)/i,
  pagination: /(page \d|next page|load more|showing \d+-\d+)/i,
  filterUi: /(filter by|sort by|refine results|search jobs)/i,
  jobCards: /(job-card|job-listing|vacancy-item|position-card)/i,
};

const URL_PATTERNS: Array<[RegExp, PageType, number]> = [
  // Individual job patterns
  [/\/jobs?\/\d+/i, 'individual_job', 80],
  [/\/careers?\/\d+/i, 'individual_job', 75],
  [/\/positions?\/[\w-]+/i, 'individual_job', 75],
  [/\/openings?\/[\w-]+/i, 'individual_job', 70],
  [/\/job\/[\w-]+/i, 'individual_job', 80],
  [/\/apply\/[\w-]+/i, 'individual_job', 70],
  [/\/vacancy\/[\w-]+/i, 'individual_job', 70],
  [/greenhouse\.io\/.*\/jobs\/\d+/i, 'individual_job', 95],
  [/lever\.co\/.*\/[\w-]+/i, 'individual_job', 90],
  [/boards\.greenhouse\.io/i, 'job_listing_page', 90],
  // Listing patterns
  [/\/jobs\/?(\?|$)/i, 'job_listing_page', 75],
  [/\/careers?\/?(\?|$)/i, 'company_careers_page', 70],
  [/\/openings?\/?(\?|$)/i, 'job_listing_page', 70],
  [/\/vacancies?\/?(\?|$)/i, 'job_listing_page', 70],
];

function classifyByUrl(url: string): { type: PageType; confidence: number } | null {
  for (const [pattern, type, confidence] of URL_PATTERNS) {
    if (pattern.test(url)) {
      return { type, confidence };
    }
  }
  return null;
}

function classifyByContent(html: string): { type: PageType; confidence: number } {
  let jobScore = 0;
  let listingScore = 0;

  // Check for JSON-LD JobPosting (highest signal)
  if (JOB_PAGE_SIGNALS.jsonLd.test(html)) {
    return { type: 'individual_job', confidence: 98 };
  }

  // Score individual job signals
  if (JOB_PAGE_SIGNALS.applyButton.test(html)) jobScore += 25;
  if (JOB_PAGE_SIGNALS.jobFields.test(html)) jobScore += 25;
  if (JOB_PAGE_SIGNALS.salaryPattern.test(html)) jobScore += 15;
  if (JOB_PAGE_SIGNALS.experiencePattern.test(html)) jobScore += 15;
  if (JOB_PAGE_SIGNALS.locationField.test(html)) jobScore += 10;
  if (JOB_PAGE_SIGNALS.employmentType.test(html)) jobScore += 10;

  // Score listing page signals
  if (LISTING_PAGE_SIGNALS.multipleJobs.test(html)) listingScore += 30;
  if (LISTING_PAGE_SIGNALS.pagination.test(html)) listingScore += 25;
  if (LISTING_PAGE_SIGNALS.filterUi.test(html)) listingScore += 25;
  if (LISTING_PAGE_SIGNALS.jobCards.test(html)) listingScore += 20;

  if (jobScore >= 50 && jobScore > listingScore) {
    return { type: 'individual_job', confidence: Math.min(95, 50 + jobScore) };
  }

  if (listingScore >= 40) {
    return { type: 'job_listing_page', confidence: Math.min(90, 40 + listingScore) };
  }

  if (jobScore >= 25) {
    return { type: 'individual_job', confidence: 40 + jobScore };
  }

  return { type: 'irrelevant', confidence: 70 };
}

// ─── Link Extraction from Listing Pages ───────────────────────────────────────

function extractJobLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;

    // Check if link looks like a job page
    const isJobLink = /\/(jobs?|positions?|openings?|careers?|apply|vacancy)\/[\w-]+/i.test(href);
    if (!isJobLink) continue;

    try {
      const absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
      links.push(absoluteUrl);
    } catch {
      // Invalid URL
    }
  }

  // Deduplicate
  return [...new Set(links)];
}

// ─── Main Classifier Service ──────────────────────────────────────────────────

export class ClassifierService {
  classify(url: string, html: string): ClassificationResult {
    // 1. Try URL-based classification
    const urlResult = classifyByUrl(url);

    // 2. Try content-based classification
    const contentResult = classifyByContent(html);

    // 3. Combine results
    let finalType: PageType;
    let confidence: number;

    if (urlResult && urlResult.confidence >= 80) {
      finalType = urlResult.type;
      confidence = urlResult.confidence;
    } else if (contentResult.confidence >= 70) {
      finalType = contentResult.type;
      confidence = contentResult.confidence;
    } else if (urlResult) {
      // URL suggests something but low confidence — blend
      finalType = urlResult.type;
      confidence = Math.round((urlResult.confidence + contentResult.confidence) / 2);
    } else {
      finalType = contentResult.type;
      confidence = contentResult.confidence;
    }

    // 4. Extract links if listing page
    let linkedUrls: string[] | undefined;
    if (finalType === 'job_listing_page' || finalType === 'company_careers_page') {
      linkedUrls = extractJobLinks(html, url);
    }

    logger.info(`Classified ${url.slice(0, 60)} as ${finalType} (${confidence}%)`);

    return {
      pageType: finalType,
      confidence,
      method: 'rule_based',
      linkedUrls,
    };
  }
}

export const classifierService = new ClassifierService();
