import { Router, RequestHandler } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate as RequestHandler);

router.get('/summary', dashboardController.getSummary as RequestHandler);
router.get('/stats', dashboardController.getStats as RequestHandler);
router.get('/monthly', dashboardController.getMonthlyStats as RequestHandler);
router.get('/weekly', dashboardController.getWeeklyStats as RequestHandler);
router.get('/timeline', dashboardController.getTimeline as RequestHandler);
router.get('/companies', dashboardController.getCompanyAnalytics as RequestHandler);

export default router;
