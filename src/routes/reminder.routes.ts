import { Router } from 'express';
import { reminderController } from '../controllers/reminder.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createReminderSchema,
  updateReminderSchema,
} from '../validators/reminder.validators';

const router = Router();

router.use(authenticate);

router.get('/upcoming', reminderController.getUpcoming);
router.get('/', reminderController.getAll);
router.post('/', validate(createReminderSchema), reminderController.create);
router.get('/:id', reminderController.getById);
router.put('/:id', validate(updateReminderSchema), reminderController.update);
router.delete('/:id', reminderController.delete);
router.patch('/:id/dismiss', reminderController.dismiss);

export default router;
