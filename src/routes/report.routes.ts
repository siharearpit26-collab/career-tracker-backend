import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { generateReportSchema } from '../validators/report.validators';

const router = Router();

router.use(authenticate);

router.get('/history', reportController.getHistory);
router.post('/monthly', reportController.generateMonthly);
router.post('/yearly', reportController.generateYearly);
router.post('/custom', validate(generateReportSchema), reportController.generateCustom);
router.delete('/:id', reportController.deleteReport);

export default router;
