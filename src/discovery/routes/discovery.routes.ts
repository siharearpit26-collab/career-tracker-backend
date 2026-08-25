import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sourceRegistryService } from '../services/sourceRegistry.service';
import { urlDiscoveryService } from '../services/urlDiscovery.service';
import { pipelineService } from '../services/pipeline.service';
import { sitemapDiscoveryService } from '../services/sitemapDiscovery.service';
import { JobModel, JobUrlModel, JobSourceModel } from '../models';

const router = Router();

// All discovery admin routes require auth + admin
router.use(authenticate as RequestHandler);
router.use(authorize('admin') as RequestHandler);

// ─── Source CRUD ──────────────────────────────────────────────────────────────

// GET /api/v1/admin/sources
router.get('/sources', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, sourceType, page = '1', limit = '20', sortBy, sortOrder } = _req.query as Record<string, string>;

    const result = await sourceRegistryService.getAll({
      status: status as 'active' | 'degraded' | 'temporarily_disabled' | 'disabled' | undefined,
      sourceType,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Sources retrieved',
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/sources
router.post('/sources', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain, sourceType, accessMethod, crawlPolicy, complianceNotes } = req.body as {
      domain: string;
      sourceType: 'website' | 'api' | 'feed' | 'ats_platform';
      accessMethod: 'public_page' | 'sitemap' | 'api' | 'rss' | 'structured_data';
      crawlPolicy?: Record<string, unknown>;
      complianceNotes?: string;
    };

    if (!domain || !sourceType || !accessMethod) {
      res.status(422).json({ success: false, message: 'domain, sourceType, and accessMethod are required' });
      return;
    }

    const source = await sourceRegistryService.addSource({
      domain,
      sourceType,
      accessMethod,
      crawlPolicy: crawlPolicy as Record<string, number | boolean> | undefined,
      complianceNotes,
    });

    res.status(201).json({
      success: true,
      message: 'Source added',
      data: source,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// PATCH /api/v1/admin/sources/:id
router.patch('/sources/:id', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await sourceRegistryService.update(req.params['id']!, req.body);
    if (!source) {
      res.status(404).json({ success: false, message: 'Source not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Source updated', data: source });
  } catch (error) { next(error); }
}) as RequestHandler);

// DELETE (disable) /api/v1/admin/sources/:id
router.delete('/sources/:id', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const source = await sourceRegistryService.disable(req.params['id']!, reason ?? 'Manually disabled');
    if (!source) {
      res.status(404).json({ success: false, message: 'Source not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Source disabled', data: source });
  } catch (error) { next(error); }
}) as RequestHandler);

// ─── Manual Job Creation ────────────────────────────────────────────────────

// POST /api/v1/admin/discovery/jobs — add a job manually
router.post('/jobs', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title, company, location, description, applicationUrl,
      employmentType, seniority, experienceMin, experienceMax,
      salaryMin, salaryMax, salaryCurrency, skills, workArrangement,
    } = req.body as {
      title: string; company: string; location: string; description: string;
      applicationUrl: string; employmentType?: string; seniority?: string;
      experienceMin?: number; experienceMax?: number; salaryMin?: number;
      salaryMax?: number; salaryCurrency?: string; skills?: string[];
      workArrangement?: string;
    };

    if (!title || !company || !applicationUrl) {
      res.status(422).json({ success: false, message: 'title, company, and applicationUrl are required' });
      return;
    }

    // Ensure a manual source exists
    let source = await JobSourceModel.findOne({ domain: 'manual-entry' });
    if (!source) {
      source = await JobSourceModel.create({
        domain: 'manual-entry',
        sourceType: 'website',
        accessMethod: 'public_page',
        status: 'active',
        qualityScore: 100,
        complianceNotes: 'Manually added by admin',
      });
    }

    const companyNormalized = company.toLowerCase().trim();
    const city = location || 'India';
    const skillsArr = Array.isArray(skills) ? skills : [];
    const now = new Date();

    const fingerprint = crypto
      .createHash('sha256')
      .update(`${companyNormalized}|${title.toLowerCase()}|${city.toLowerCase()}`)
      .digest('hex');

    // Check for duplicate
    const existing = await JobModel.findOne({ jobFingerprint: fingerprint });
    if (existing) {
      res.status(409).json({ success: false, message: 'A job with the same title, company, and location already exists' });
      return;
    }

    const job = await JobModel.create({
      sourceId: source._id as Types.ObjectId,
      sourceUrl: applicationUrl,
      applicationUrl,
      jobFingerprint: fingerprint,
      rawTitle: title,
      rawCompany: company,
      rawLocation: location,
      rawDescription: description,
      title,
      company,
      companyNormalized,
      description: (description ?? '').slice(0, 10000),
      locations: [{ raw: location, city, country: 'India', workArrangement: workArrangement ?? 'on-site' }],
      employmentType: employmentType ?? 'FULL_TIME',
      seniority: seniority ?? 'mid',
      experienceRange: { min: experienceMin, max: experienceMax },
      salary: (salaryMin || salaryMax)
        ? { min: salaryMin, max: salaryMax, currency: salaryCurrency ?? 'INR', period: 'annual' }
        : {},
      skills: skillsArr,
      skillsNormalized: skillsArr.map((s) => s.toLowerCase()),
      status: 'active',
      firstSeenAt: now,
      lastSeenAt: now,
      lastVerifiedAt: now,
      sourcePostedAt: now,
      extractionMethod: 'manual',
      extractionConfidence: 100,
    });

    res.status(201).json({
      success: true,
      message: 'Job added successfully',
      data: job,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// ─── Metrics ──────────────────────────────────────────────────────────────────

// GET /api/v1/admin/metrics
router.get('/metrics', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [sourceStats, jobCount, todayStart] = await Promise.all([
      sourceRegistryService.getStats(),
      JobModel.countDocuments({ status: 'active' }),
      Promise.resolve(new Date(new Date().setHours(0, 0, 0, 0))),
    ]);

    const [addedToday, urlsQueued] = await Promise.all([
      JobModel.countDocuments({ createdAt: { $gte: todayStart } }),
      JobUrlModel.countDocuments({ status: 'queued' }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Metrics retrieved',
      data: {
        sources: sourceStats,
        jobs: {
          totalIndexed: jobCount,
          addedToday,
        },
        queues: {
          urlsQueued,
        },
      },
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// GET /api/v1/admin/discovery/queues
router.get('/queues', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await urlDiscoveryService.getStats();
    res.status(200).json({
      success: true,
      message: 'Queue stats retrieved',
      data: stats,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/urls — manually submit URLs
router.post('/urls', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { urls } = req.body as { urls: Array<{ url: string; domain: string; sourceId?: string; discoveryMethod: string }> };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(422).json({ success: false, message: 'urls array is required' });
      return;
    }

    // Auto-register sources for domains that don't have one
    for (const u of urls) {
      if (!u.sourceId || u.sourceId === '') {
        const source = await sourceRegistryService.addSource({
          domain: u.domain,
          sourceType: 'website',
          accessMethod: 'public_page',
        });
        u.sourceId = source._id.toString();
      }
    }

    const result = await urlDiscoveryService.submitBatch(
      urls.map((u) => ({
        url: u.url,
        domain: u.domain,
        sourceId: u.sourceId!,
        discoveryMethod: (u.discoveryMethod ?? 'manual') as 'manual',
      }))
    );

    res.status(201).json({
      success: true,
      message: `Submitted ${result.added} new URLs (${result.duplicates} duplicates skipped)`,
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/retry-failed — retry failed URLs
router.post('/retry-failed', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await urlDiscoveryService.retryFailed();
    res.status(200).json({
      success: true,
      message: `${count} failed URLs requeued for retry`,
      data: { retriedCount: count },
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/run — trigger pipeline cycle
router.post('/run', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchSize = '10' } = req.query as Record<string, string>;
    const result = await pipelineService.runCycle(parseInt(batchSize, 10));
    res.status(200).json({
      success: true,
      message: 'Pipeline cycle completed',
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/expire — run expiration check
router.post('/expire', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const expired = await pipelineService.runExpirationCheck();
    res.status(200).json({
      success: true,
      message: `${expired} jobs expired`,
      data: { expiredCount: expired },
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/alerts/daily — trigger daily alerts
router.post('/alerts/daily', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await pipelineService.runDailyAlerts();
    res.status(200).json({
      success: true,
      message: `${count} daily alerts processed`,
      data: { alertsProcessed: count },
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/discover — run sitemap discovery
router.post('/discover', (async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await sitemapDiscoveryService.runFullDiscovery();
    res.status(200).json({
      success: true,
      message: `Discovery complete: ${result.totalDiscovered} URLs from ${result.sourcesProcessed} sources`,
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/adzuna-sync — fetch real jobs from Adzuna API
router.post('/adzuna-sync', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adzunaSyncService } = await import('../services/adzunaSync.service');
    const { queries } = req.body as { queries?: Array<{ what: string; where?: string }> };

    // Default queries covering common tech roles across major Indian cities
    const defaultQueries = [
      { what: 'python developer', where: 'india' },
      { what: 'software engineer', where: 'bengaluru' },
      { what: 'full stack developer', where: 'india' },
      { what: 'backend developer', where: 'india' },
      { what: 'frontend developer', where: 'india' },
      { what: 'react developer', where: 'india' },
      { what: 'django developer', where: 'india' },
      { what: 'fresher software', where: 'india' },
    ];

    const result = await adzunaSyncService.syncJobs(queries ?? defaultQueries);
    res.status(200).json({
      success: true,
      message: `Adzuna sync: ${result.added} new jobs added, ${result.updated} updated`,
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/admin/discovery/discover/:sourceId — discover from specific source
router.post('/discover/:sourceId', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await sourceRegistryService.getById(req.params['sourceId']!);
    if (!source) {
      res.status(404).json({ success: false, message: 'Source not found' });
      return;
    }
    const result = await sitemapDiscoveryService.discoverFromSitemap(source.domain, source._id.toString());
    res.status(200).json({
      success: true,
      message: `Discovered ${result.discovered} new URLs from ${source.domain}`,
      data: result,
    });
  } catch (error) { next(error); }
}) as RequestHandler);

export default router;
