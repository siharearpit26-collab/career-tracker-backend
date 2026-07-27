import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/summary', dashboardController.getSummary);
router.get('/stats', dashboardController.getStats);
router.get('/monthly', dashboardController.getMonthlyStats);
router.get('/weekly', dashboardController.getWeeklyStats);
router.get('/timeline', dashboardController.getTimeline);
router.get('/companies', dashboardController.getCompanyAnalytics);

export default router;
