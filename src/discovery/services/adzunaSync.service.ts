import crypto from 'crypto';
import { Types } from 'mongoose';
import { JobModel, JobSourceModel } from '../models';
import { adzunaService, AdzunaJob } from './adzuna.service';
import { logger } from '../../utils/logger';

// Map Adzuna contract type to our employment type enum
function mapEmploymentType(contractType?: string): string {
  if (!contractType) return 'FULL_TIME';
  const t = contractType.toLowerCase();
  if (t.includes('part')) return 'PART_TIME';
  if (t.includes('contract')) return 'CONTRACT';
  if (t.includes('intern')) return 'INTERNSHIP';
  return 'FULL_TIME';
}

// Infer seniority from title
function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/intern|trainee|fresher|graduate/.test(t)) return 'junior';
  if (/senior|sr\.|lead|staff|principal/.test(t)) return 'senior';
  if (/junior|jr\.|entry|associate/.test(t)) return 'junior';
  if (/manager|director|head|vp/.test(t)) return 'director';
  return 'mid';
}

// Extract common tech skills from description
const KNOWN_SKILLS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js',
  'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Express', 'MongoDB', 'MySQL', 'PostgreSQL',
  'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'REST APIs',
  'GraphQL', 'HTML', 'CSS', 'Bootstrap', 'Tailwind', 'Go', 'Rust', 'C++', 'C#', 'PHP',
  'Ruby', 'Swift', 'Kotlin', 'Android', 'iOS', 'Machine Learning', 'TensorFlow', 'PyTorch',
  'SQL', 'NoSQL', 'Microservices', 'CI/CD', 'Terraform', 'Spark', 'Hadoop',
];

function extractSkills(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const skill of KNOWN_SKILLS) {
    if (lower.includes(skill.toLowerCase())) found.push(skill);
  }
  return found.slice(0, 12);
}

export class AdzunaSyncService {
  /**
   * Fetch real jobs from Adzuna and upsert them into the jobs collection.
   */
  async syncJobs(queries: Array<{ what: string; where?: string }>): Promise<{ added: number; updated: number }> {
    if (!adzunaService.isConfigured()) {
      logger.warn('Adzuna not configured — skipping sync');
      return { added: 0, updated: 0 };
    }

    // Ensure an Adzuna source exists
    let source = await JobSourceModel.findOne({ domain: 'adzuna.in' });
    if (!source) {
      source = await JobSourceModel.create({
        domain: 'adzuna.in',
        sourceType: 'api',
        accessMethod: 'api',
        status: 'active',
        qualityScore: 85,
        complianceNotes: 'Official Adzuna job aggregator API',
      });
    }
    const sourceId = source._id as Types.ObjectId;

    let added = 0;
    let updated = 0;

    for (const q of queries) {
      const { jobs } = await adzunaService.search({
        what: q.what,
        where: q.where,
        resultsPerPage: 25,
        maxDaysOld: 30,
      });

      for (const job of jobs) {
        const result = await this.upsertJob(job, sourceId);
        if (result === 'added') added++;
        else if (result === 'updated') updated++;
      }
    }

    logger.info(`Adzuna sync complete: ${added} added, ${updated} updated`);
    return { added, updated };
  }

  private async upsertJob(job: AdzunaJob, sourceId: Types.ObjectId): Promise<'added' | 'updated' | 'skipped'> {
    const companyNormalized = job.company.toLowerCase().trim();
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${companyNormalized}|${job.title.toLowerCase()}|${job.city.toLowerCase()}`)
      .digest('hex');

    const skills = extractSkills(`${job.title} ${job.description}`);
    const now = new Date();

    const existing = await JobModel.findOne({ jobFingerprint: fingerprint });

    const doc = {
      sourceId,
      sourceUrl: job.applyUrl,
      sourceJobId: job.id,
      applicationUrl: job.applyUrl,
      jobFingerprint: fingerprint,
      rawTitle: job.title,
      rawCompany: job.company,
      rawLocation: job.location,
      rawDescription: job.description,
      title: job.title,
      company: job.company,
      companyNormalized,
      description: job.description.slice(0, 10000),
      locations: [{ raw: job.location, city: job.city, country: 'India', workArrangement: 'on-site' }],
      employmentType: mapEmploymentType(job.contractType),
      seniority: inferSeniority(job.title),
      experienceRange: {},
      salary: (job.salaryMin || job.salaryMax)
        ? { min: job.salaryMin, max: job.salaryMax, currency: 'INR', period: 'annual' }
        : {},
      skills,
      skillsNormalized: skills.map((s) => s.toLowerCase()),
      status: 'active',
      lastSeenAt: now,
      sourcePostedAt: job.postedAt,
      lastVerifiedAt: now,
      extractionMethod: 'structured_data',
      extractionConfidence: 95,
    };

    if (existing) {
      await JobModel.updateOne({ _id: existing._id }, { $set: doc });
      return 'updated';
    } else {
      await JobModel.create({ ...doc, firstSeenAt: now });
      return 'added';
    }
  }
}

export const adzunaSyncService = new AdzunaSyncService();
