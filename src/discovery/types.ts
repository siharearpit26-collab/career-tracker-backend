import { Types, Document } from 'mongoose';

// ─── Source Registry Types ────────────────────────────────────────────────────

export type SourceStatus = 'active' | 'degraded' | 'temporarily_disabled' | 'disabled';
export type SourceType = 'website' | 'api' | 'feed' | 'ats_platform';
export type AccessMethod = 'public_page' | 'sitemap' | 'api' | 'rss' | 'structured_data';

export interface CrawlPolicy {
  maxRequestsPerMinute: number;
  crawlBudgetPerDay: number;
  respectRobots: boolean;
  requiresBrowserRendering: boolean;
  scheduleHours: number; // re-crawl every N hours
  concurrency: number;
}

export interface IJobSource {
  domain: string;
  sourceType: SourceType;
  accessMethod: AccessMethod;
  status: SourceStatus;
  robotsStatus: 'allowed' | 'restricted' | 'unknown';
  crawlPolicy: CrawlPolicy;
  qualityScore: number; // 0-100
  lastCrawledAt?: Date;
  lastSuccessfulCrawlAt?: Date;
  failureCount: number;
  consecutiveFailures: number;
  totalJobsDiscovered: number;
  totalValidJobs: number;
  discoveredAt: Date;
  disabledReason?: string;
  complianceNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJobSourceDocument extends IJobSource, Document {
  _id: Types.ObjectId;
}

// ─── Discovered URL Types ─────────────────────────────────────────────────────

export type UrlStatus = 'queued' | 'fetching' | 'fetched' | 'classified' | 'extracted' | 'indexed' | 'failed' | 'skipped';
export type DiscoveryMethod = 'sitemap' | 'search' | 'structured_data' | 'ats_pattern' | 'listing_page' | 'manual' | 'feed';

export interface IJobUrl {
  url: string;
  urlFingerprint: string; // SHA-256 of canonical URL
  domain: string;
  sourceId: Types.ObjectId;
  status: UrlStatus;
  discoveryMethod: DiscoveryMethod;
  priority: number; // 0-100
  fetchAttempts: number;
  lastFetchAt?: Date;
  httpStatus?: number;
  contentHash?: string;
  pageType?: PageType;
  classificationConfidence?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJobUrlDocument extends IJobUrl, Document {
  _id: Types.ObjectId;
}

// ─── Job Types ────────────────────────────────────────────────────────────────

export type JobStatus = 'discovered' | 'active' | 'updated' | 'expired' | 'removed';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE' | 'OTHER';
export type WorkArrangement = 'onsite' | 'remote' | 'hybrid';
export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'director' | 'vp' | 'unknown';
export type PageType = 'individual_job' | 'job_listing_page' | 'company_careers_page' | 'search_page' | 'irrelevant' | 'unknown';
export type ExtractionMethod = 'json_ld' | 'opengraph' | 'html_semantic' | 'ats_adapter' | 'ai_extraction';

export interface JobLocation {
  raw: string;
  city?: string;
  state?: string;
  country?: string;
  workArrangement: WorkArrangement;
}

export interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
  period?: 'hourly' | 'monthly' | 'annual';
}

export interface ExperienceRange {
  min?: number;
  max?: number;
}

export interface IJob {
  // Identity
  sourceId: Types.ObjectId;
  sourceUrl: string;
  sourceJobId?: string;
  applicationUrl?: string;
  jobFingerprint: string;

  // Raw extracted
  rawTitle: string;
  rawCompany: string;
  rawLocation?: string;
  rawDescription?: string;

  // Normalized
  title: string;
  company: string;
  companyNormalized: string;
  description: string;
  locations: JobLocation[];
  employmentType: EmploymentType;
  seniority: Seniority;
  experienceRange: ExperienceRange;
  salary: SalaryRange;
  skills: string[];
  skillsNormalized: string[];

  // Lifecycle
  status: JobStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sourcePostedAt?: Date;
  lastVerifiedAt: Date;

  // Metadata
  extractionMethod: ExtractionMethod;
  extractionConfidence: number; // 0-100
  alternateSourceUrls: string[];
  duplicateOf?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IJobDocument extends IJob, Document {
  _id: Types.ObjectId;
}

// ─── User Interaction Types ───────────────────────────────────────────────────

export interface ISavedJob {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  savedAt: Date;
  notes?: string;
}

export interface ISavedJobDocument extends ISavedJob, Document {
  _id: Types.ObjectId;
}

export interface IJobAlert {
  userId: Types.ObjectId;
  name: string;
  criteria: {
    keywords?: string[];
    locations?: string[];
    skills?: string[];
    employmentTypes?: EmploymentType[];
    workArrangement?: WorkArrangement[];
    experienceMin?: number;
    experienceMax?: number;
    salaryMin?: number;
    salaryCurrency?: string;
  };
  minimumMatchScore: number; // 0-100
  frequency: 'immediate' | 'daily' | 'weekly';
  isActive: boolean;
  lastNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJobAlertDocument extends IJobAlert, Document {
  _id: Types.ObjectId;
}

// ─── Match Score Types ────────────────────────────────────────────────────────

export interface MatchScore {
  total: number; // 0-100
  breakdown: {
    roleMatch: number;
    skillMatch: number;
    experienceMatch: number;
    locationMatch: number;
    salaryMatch: number;
  };
  matchedSkills: string[];
  matchReasons: string[];
}

// ─── Pipeline Types ───────────────────────────────────────────────────────────

export interface FetchResult {
  url: string;
  httpStatus: number;
  contentType?: string;
  html?: string;
  contentHash: string;
  fetchedAt: Date;
  responseTime: number;
}

export interface ClassificationResult {
  pageType: PageType;
  confidence: number;
  method: 'rule_based' | 'ai';
  linkedUrls?: string[]; // For listing pages
}

export interface ExtractionResult {
  method: ExtractionMethod;
  confidence: number;
  data: Partial<IJob>;
}
