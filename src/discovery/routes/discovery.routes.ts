import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { sourceRegistryService } from '../services/sourceRegistry.service';
import { JobModel, JobUrlModel } from '../models';

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

export default router;
