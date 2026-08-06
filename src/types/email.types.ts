import { Types, Document } from 'mongoose';

export type EmailProvider = 'gmail' | 'outlook';

export type EmailClassificationType =
  | 'recruitment'
  | 'rejection'
  | 'offer'
  | 'interview'
  | 'follow_up'
  | 'unrelated';

export type EmailCategory =
  | 'application_received'
  | 'application_viewed'
  | 'shortlisted'
  | 'assessment_sent'
  | 'assessment_completed'
  | 'phone_screen_scheduled'
  | 'phone_screen_completed'
  | 'technical_interview_scheduled'
  | 'technical_interview_completed'
  | 'onsite_interview_scheduled'
  | 'onsite_interview_completed'
  | 'offer_extended'
  | 'offer_accepted'
  | 'rejection'
  | 'follow_up'
  | 'unknown';

export type ProcessingMethod = 'ai' | 'rule_based' | 'pre_filter';

export interface IEmailAccount {
  userId: Types.ObjectId;
  provider: EmailProvider;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  lastSyncedAt?: Date;
  syncCursor?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailAccountDocument extends IEmailAccount, Document {
  _id: Types.ObjectId;
}

export interface IEmailSync {
  emailAccountId: Types.ObjectId;
  userId: Types.ObjectId;
  messageId: string;
  threadId?: string;
  subject: string;
  from: string;
  receivedAt: Date;
  snippet: string;
  classification: EmailClassificationType;
  category?: EmailCategory;
  confidence: number;
  applicationId?: Types.ObjectId;
  statusUpdate?: string;
  isConfirmed: boolean;
  processingMethod?: ProcessingMethod;
  fallbackReason?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location?: string;
  requiredAction?: string;
  summary?: string;
  importantDates?: Record<string, string>;
  isPendingReview?: boolean;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailSyncDocument extends IEmailSync, Document {
  _id: Types.ObjectId;
}

export interface ConnectEmailDTO {
  provider: EmailProvider;
  code: string;
  redirectUri: string;
}

export interface EmailSyncResult {
  newEmails: number;
  classified: number;
  matched: number;
  statusUpdates: number;
  autoCreated?: number;
}

export interface EmailClassificationResult {
  classification: EmailClassificationType;
  category?: EmailCategory;
  confidence: number;
  applicationId?: string;
  suggestedStatus?: string;
  processingMethod?: ProcessingMethod;
  fallbackReason?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location?: string;
  requiredAction?: string;
  summary?: string;
  importantDates?: Record<string, string>;
  isPendingReview?: boolean;
  // AI-extracted fields for auto-create
  aiCompany?: string;
  aiJobTitle?: string;
}
