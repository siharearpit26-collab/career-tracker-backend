import { Router, RequestHandler } from 'express';
import { reminderController } from '../controllers/reminder.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createReminderSchema,
  updateReminderSchema,
} from '../validators/reminder.validators';

const router = Router();

router.use(authenticate as RequestHandler);

router.get('/upcoming', reminderController.getUpcoming as RequestHandler);
router.get('/', reminderController.getAll as RequestHandler);
router.post('/', validate(createReminderSchema), reminderController.create as RequestHandler);
router.get('/:id', reminderController.getById as RequestHandler);
router.put('/:id', validate(updateReminderSchema), reminderController.update as RequestHandler);
router.delete('/:id', reminderController.delete as RequestHandler);
router.patch('/:id/dismiss', reminderController.dismiss as RequestHandler);

export default router;
