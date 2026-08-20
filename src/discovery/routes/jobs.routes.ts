import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { jobSearchService, JobSearchFilters, UserProfile } from '../services/jobSearch.service';
import { AuthenticatedRequest } from '../../types';

const router = Router();

// All job routes require authentication
router.use(authenticate as RequestHandler);

// ─── Search Jobs ──────────────────────────────────────────────────────────────

// GET /api/v1/jobs/search
router.get('/search', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const {
      q, location, skills, employmentType, workArrangement,
      experienceMin, experienceMax, salaryMin, salaryCurrency,
      postedAfter, page = '1', limit = '20', sortBy,
    } = req.query as Record<string, string>;

    const filters: JobSearchFilters = {
      query: q,
      location,
      skills: skills ? skills.split(',') : undefined,
      employmentType: employmentType as JobSearchFilters['employmentType'],
      workArrangement: workArrangement as JobSearchFilters['workArrangement'],
      experienceMin: experienceMin ? parseInt(experienceMin, 10) : undefined,
      experienceMax: experienceMax ? parseInt(experienceMax, 10) : undefined,
      salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
      salaryCurrency,
      postedAfter: postedAfter ? new Date(postedAfter) : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: sortBy as JobSearchFilters['sortBy'],
    };

    // Load user's job preferences for match scoring
    const { UserModel } = await import('../../models');
    const user = await UserModel.findById(authReq.userId);
    const jobPrefs = (user as unknown as Record<string, unknown>)?.['jobPreferences'] as UserProfile | undefined;

    const profile: UserProfile = jobPrefs ?? {};

    const result = await jobSearchService.search(filters, authReq.userId, profile);

    res.status(200).json({
      success: true,
      message: 'Jobs found',
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// GET /api/v1/jobs/recommended
router.get('/recommended', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { limit = '10' } = req.query as Record<string, string>;

    // Simple profile — in future, pull from user preferences/application history
    const profile: UserProfile = {};

    const jobs = await jobSearchService.getRecommended(
      authReq.userId!,
      profile,
      parseInt(limit, 10)
    );

    res.status(200).json({
      success: true,
      message: 'Recommended jobs',
      data: jobs,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// GET /api/v1/jobs/:id
router.get('/:id', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const profile: UserProfile = {};

    const job = await jobSearchService.getById(req.params['id']!, authReq.userId, profile);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Job retrieved',
      data: job,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// ─── Save/Unsave Jobs ─────────────────────────────────────────────────────────

// POST /api/v1/jobs/:id/save
router.post('/:id/save', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await jobSearchService.saveJob(authReq.userId!, req.params['id']!);
    res.status(200).json({ success: true, message: 'Job saved' });
  } catch (error) { next(error); }
}) as RequestHandler);

// DELETE /api/v1/jobs/:id/save
router.delete('/:id/save', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await jobSearchService.unsaveJob(authReq.userId!, req.params['id']!);
    res.status(200).json({ success: true, message: 'Job unsaved' });
  } catch (error) { next(error); }
}) as RequestHandler);

// GET /api/v1/jobs/saved
router.get('/user/saved', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page = '1', limit = '20' } = req.query as Record<string, string>;

    const result = await jobSearchService.getSavedJobs(
      authReq.userId!,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    res.status(200).json({
      success: true,
      message: 'Saved jobs retrieved',
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// ─── Track Application ────────────────────────────────────────────────────────

// POST /api/v1/jobs/:id/track
router.post('/:id/track', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const job = await jobSearchService.getById(req.params['id']!);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    // Create application in existing tracker
    const { applicationRepository } = await import('../../repositories/application.repository');
    const application = await applicationRepository.create(authReq.userId!, {
      company: job.company,
      jobTitle: job.title,
      location: job.locations[0]?.city ?? job.rawLocation ?? '',
      status: 'Applied',
      source: 'Other',
      jobUrl: job.applicationUrl ?? job.sourceUrl,
      notes: `Discovered via CareerTracker Job Discovery\nSource: ${job.sourceUrl}`,
      salaryMin: job.salary?.min,
      salaryMax: job.salary?.max,
      salaryCurrency: job.salary?.currency,
    });

    res.status(201).json({
      success: true,
      message: 'Application created from discovered job',
      data: application,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

export default router;
