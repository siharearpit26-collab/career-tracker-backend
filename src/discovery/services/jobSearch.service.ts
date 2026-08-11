import { Types } from 'mongoose';
import { JobModel, SavedJobModel } from '../models';
import { IJobDocument, MatchScore, WorkArrangement, EmploymentType } from '../types';
import { logger } from '../../utils/logger';

export interface JobSearchFilters {
  query?: string;
  location?: string;
  skills?: string[];
  employmentType?: EmploymentType;
  workArrangement?: WorkArrangement;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryCurrency?: string;
  postedAfter?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'posted' | 'salary' | 'match';
}

export interface UserProfile {
  preferredRoles?: string[];
  skills?: string[];
  experienceYears?: number;
  preferredLocations?: string[];
  preferredWorkArrangement?: WorkArrangement[];
  salaryExpectation?: number;
  salaryCurrency?: string;
}

export interface JobSearchResult {
  jobs: Array<IJobDocument & { matchScore?: MatchScore; isSaved?: boolean }>;
  total: number;
  page: number;
  totalPages: number;
}

// ─── Personal Match Engine ────────────────────────────────────────────────────

function computeMatchScore(job: IJobDocument, profile: UserProfile): MatchScore {
  const breakdown = {
    roleMatch: 0,
    skillMatch: 0,
    experienceMatch: 0,
    locationMatch: 0,
    salaryMatch: 0,
  };
  const matchedSkills: string[] = [];
  const matchReasons: string[] = [];

  // Role Match (30%)
  if (profile.preferredRoles?.length) {
    const jobTitle = job.title.toLowerCase();
    const matched = profile.preferredRoles.some((role) =>
      jobTitle.includes(role.toLowerCase()) || role.toLowerCase().includes(jobTitle.split(' ')[0]!)
    );
    if (matched) {
      breakdown.roleMatch = 100;
      matchReasons.push('Your preferred role');
    } else {
      // Partial match
      const words = profile.preferredRoles.flatMap((r) => r.toLowerCase().split(' '));
      const titleWords = jobTitle.split(' ');
      const overlap = words.filter((w) => titleWords.includes(w) && w.length > 3);
      breakdown.roleMatch = Math.min(100, overlap.length * 30);
      if (overlap.length > 0) matchReasons.push('Related to your preferred role');
    }
  } else {
    breakdown.roleMatch = 50; // No preference = neutral
  }

  // Skill Match (30%)
  if (profile.skills?.length) {
    const jobSkills = job.skillsNormalized.map((s) => s.toLowerCase());
    const userSkills = profile.skills.map((s) => s.toLowerCase());
    const matched = userSkills.filter((s) => jobSkills.includes(s));
    matchedSkills.push(...matched);

    if (userSkills.length > 0) {
      breakdown.skillMatch = Math.min(100, Math.round((matched.length / Math.min(userSkills.length, 5)) * 100));
    }
    if (matched.length > 0) matchReasons.push(`${matched.length} matching skills`);
  } else {
    breakdown.skillMatch = 50;
  }

  // Experience Match (20%)
  if (profile.experienceYears !== undefined) {
    const min = job.experienceRange?.min ?? 0;
    const max = job.experienceRange?.max ?? 20;
    if (profile.experienceYears >= min && profile.experienceYears <= max) {
      breakdown.experienceMatch = 100;
      matchReasons.push('Experience matches');
    } else if (profile.experienceYears >= min - 1 && profile.experienceYears <= max + 2) {
      breakdown.experienceMatch = 70;
      matchReasons.push('Experience close to requirements');
    } else {
      breakdown.experienceMatch = 20;
    }
  } else {
    breakdown.experienceMatch = 50;
  }

  // Location Match (10%)
  if (profile.preferredLocations?.length) {
    const userLocations = profile.preferredLocations.map((l) => l.toLowerCase());
    const jobLocations = job.locations.map((l) => (l.city ?? l.raw).toLowerCase());
    const jobArrangements = job.locations.map((l) => l.workArrangement);

    if (jobArrangements.includes('remote') && profile.preferredWorkArrangement?.includes('remote')) {
      breakdown.locationMatch = 100;
      matchReasons.push('Remote available');
    } else {
      const matched = userLocations.some((ul) => jobLocations.some((jl) => jl.includes(ul) || ul.includes(jl)));
      breakdown.locationMatch = matched ? 100 : 20;
      if (matched) matchReasons.push('Location matches');
    }
  } else {
    breakdown.locationMatch = 50;
  }

  // Salary Match (10%)
  if (profile.salaryExpectation && job.salary?.max) {
    if (job.salary.max >= profile.salaryExpectation) {
      breakdown.salaryMatch = 100;
      matchReasons.push('Salary meets expectations');
    } else if (job.salary.max >= profile.salaryExpectation * 0.8) {
      breakdown.salaryMatch = 70;
    } else {
      breakdown.salaryMatch = 30;
    }
  } else {
    breakdown.salaryMatch = 50;
  }

  // Weighted total: Role 30%, Skills 30%, Experience 20%, Location 10%, Salary 10%
  const total = Math.round(
    breakdown.roleMatch * 0.3 +
    breakdown.skillMatch * 0.3 +
    breakdown.experienceMatch * 0.2 +
    breakdown.locationMatch * 0.1 +
    breakdown.salaryMatch * 0.1
  );

  return { total, breakdown, matchedSkills, matchReasons };
}

// ─── Main Search Service ──────────────────────────────────────────────────────

export class JobSearchService {
  /**
   * Search jobs with filters and pagination.
   */
  async search(filters: JobSearchFilters, userId?: string, profile?: UserProfile): Promise<JobSearchResult> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      status: { $in: ['active', 'updated'] },
    };

    // Text search
    if (filters.query) {
      query['$text'] = { $search: filters.query };
    }

    // Location filter
    if (filters.location) {
      query['$or'] = [
        { 'locations.city': { $regex: filters.location, $options: 'i' } },
        { 'locations.country': { $regex: filters.location, $options: 'i' } },
        { rawLocation: { $regex: filters.location, $options: 'i' } },
      ];
    }

    // Skills filter
    if (filters.skills?.length) {
      query['skillsNormalized'] = { $in: filters.skills };
    }

    // Employment type
    if (filters.employmentType) {
      query['employmentType'] = filters.employmentType;
    }

    // Work arrangement
    if (filters.workArrangement) {
      query['locations.workArrangement'] = filters.workArrangement;
    }

    // Experience range
    if (filters.experienceMin !== undefined || filters.experienceMax !== undefined) {
      if (filters.experienceMin !== undefined) {
        query['experienceRange.max'] = { $gte: filters.experienceMin };
      }
      if (filters.experienceMax !== undefined) {
        query['experienceRange.min'] = { $lte: filters.experienceMax };
      }
    }

    // Salary filter
    if (filters.salaryMin) {
      query['salary.max'] = { $gte: filters.salaryMin };
    }

    // Posted date
    if (filters.postedAfter) {
      query['sourcePostedAt'] = { $gte: filters.postedAfter };
    }

    // Sort
    let sort: Record<string, 1 | -1> = { sourcePostedAt: -1 };
    if (filters.sortBy === 'salary') sort = { 'salary.max': -1 };
    if (filters.query) sort = { score: { $meta: 'textScore' } } as unknown as Record<string, 1 | -1>;

    const [jobs, total] = await Promise.all([
      filters.query
        ? JobModel.find(query, { score: { $meta: 'textScore' } }).sort(sort).skip(skip).limit(limit)
        : JobModel.find(query).sort(sort).skip(skip).limit(limit),
      JobModel.countDocuments(query),
    ]);

    // Add match scores if user profile available
    let enrichedJobs = jobs as Array<IJobDocument & { matchScore?: MatchScore; isSaved?: boolean }>;

    if (profile) {
      enrichedJobs = jobs.map((job) => {
        const matchScore = computeMatchScore(job, profile);
        return Object.assign(job.toObject(), { matchScore }) as IJobDocument & { matchScore: MatchScore };
      });

      // Sort by match score if requested
      if (filters.sortBy === 'match') {
        enrichedJobs.sort((a, b) => (b.matchScore?.total ?? 0) - (a.matchScore?.total ?? 0));
      }
    }

    // Check saved status
    if (userId) {
      const savedJobs = await SavedJobModel.find({
        userId: new Types.ObjectId(userId),
        jobId: { $in: jobs.map((j) => j._id) },
      });
      const savedIds = new Set(savedJobs.map((s) => s.jobId.toString()));
      enrichedJobs = enrichedJobs.map((j) => {
        (j as Record<string, unknown>)['isSaved'] = savedIds.has(j._id.toString());
        return j;
      });
    }

    return {
      jobs: enrichedJobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get personalized recommended jobs.
   */
  async getRecommended(userId: string, profile: UserProfile, limit = 10): Promise<Array<IJobDocument & { matchScore: MatchScore }>> {
    // Get recent active jobs
    const jobs = await JobModel.find({
      status: { $in: ['active', 'updated'] },
      sourcePostedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ sourcePostedAt: -1 })
      .limit(200);

    // Score all jobs
    const scored = jobs.map((job) => ({
      ...job.toObject(),
      matchScore: computeMatchScore(job, profile),
    })) as Array<IJobDocument & { matchScore: MatchScore }>;

    // Return top matches
    scored.sort((a, b) => b.matchScore.total - a.matchScore.total);
    return scored.slice(0, limit);
  }

  /**
   * Get a single job by ID.
   */
  async getById(jobId: string, userId?: string, profile?: UserProfile): Promise<(IJobDocument & { matchScore?: MatchScore; isSaved?: boolean }) | null> {
    const job = await JobModel.findById(jobId);
    if (!job) return null;

    const result = job.toObject() as IJobDocument & { matchScore?: MatchScore; isSaved?: boolean };

    if (profile) {
      result.matchScore = computeMatchScore(job, profile);
    }

    if (userId) {
      const saved = await SavedJobModel.findOne({
        userId: new Types.ObjectId(userId),
        jobId: new Types.ObjectId(jobId),
      });
      result.isSaved = !!saved;
    }

    return result;
  }

  /**
   * Save/unsave a job.
   */
  async saveJob(userId: string, jobId: string): Promise<void> {
    await SavedJobModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), jobId: new Types.ObjectId(jobId) },
      { $setOnInsert: { savedAt: new Date() } },
      { upsert: true }
    );
  }

  async unsaveJob(userId: string, jobId: string): Promise<void> {
    await SavedJobModel.deleteOne({
      userId: new Types.ObjectId(userId),
      jobId: new Types.ObjectId(jobId),
    });
  }

  async getSavedJobs(userId: string, page = 1, limit = 20): Promise<{ jobs: IJobDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const saved = await SavedJobModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(limit);

    const jobIds = saved.map((s) => s.jobId);
    const [jobs, total] = await Promise.all([
      JobModel.find({ _id: { $in: jobIds } }),
      SavedJobModel.countDocuments({ userId: new Types.ObjectId(userId) }),
    ]);

    return { jobs, total };
  }
}

export const jobSearchService = new JobSearchService();
