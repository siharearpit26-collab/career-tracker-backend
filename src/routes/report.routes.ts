import { Router, RequestHandler } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { generateReportSchema } from '../validators/report.validators';

const router = Router();

router.use(authenticate as RequestHandler);

router.get('/history', reportController.getHistory as RequestHandler);
router.post('/monthly', reportController.generateMonthly as RequestHandler);
router.post('/yearly', reportController.generateYearly as RequestHandler);
router.post('/custom', validate(generateReportSchema), reportController.generateCustom as RequestHandler);
router.delete('/:id', reportController.deleteReport as RequestHandler);

export default router;
