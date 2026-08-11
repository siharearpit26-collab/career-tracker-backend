import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { jobAlertsService } from '../services/jobAlerts.service';
import { AuthenticatedRequest } from '../../types';

const router = Router();

router.use(authenticate as RequestHandler);

// GET /api/v1/job-alerts
router.get('/', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const alerts = await jobAlertsService.getByUserId(authReq.userId!);
    res.status(200).json({ success: true, message: 'Alerts retrieved', data: alerts });
  } catch (error) { next(error); }
}) as RequestHandler);

// POST /api/v1/job-alerts
router.post('/', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, criteria, minimumMatchScore, frequency } = req.body as {
      name: string;
      criteria: Record<string, unknown>;
      minimumMatchScore?: number;
      frequency?: 'immediate' | 'daily' | 'weekly';
    };

    if (!name || !criteria) {
      res.status(422).json({ success: false, message: 'name and criteria are required' });
      return;
    }

    const alert = await jobAlertsService.create(authReq.userId!, {
      name,
      criteria: criteria as Parameters<typeof jobAlertsService.create>[1]['criteria'],
      minimumMatchScore,
      frequency,
    });

    res.status(201).json({ success: true, message: 'Alert created', data: alert });
  } catch (error) {
    if ((error as Error).message === 'Maximum 10 alerts allowed') {
      res.status(400).json({ success: false, message: 'Maximum 10 alerts allowed' });
      return;
    }
    next(error);
  }
}) as RequestHandler);

// PATCH /api/v1/job-alerts/:id
router.patch('/:id', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const alert = await jobAlertsService.update(req.params['id']!, authReq.userId!, req.body);
    if (!alert) {
      res.status(404).json({ success: false, message: 'Alert not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Alert updated', data: alert });
  } catch (error) { next(error); }
}) as RequestHandler);

// DELETE /api/v1/job-alerts/:id
router.delete('/:id', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const deleted = await jobAlertsService.delete(req.params['id']!, authReq.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Alert not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Alert deleted' });
  } catch (error) { next(error); }
}) as RequestHandler);

export default router;
