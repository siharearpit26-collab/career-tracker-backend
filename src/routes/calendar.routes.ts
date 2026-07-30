import { Router, RequestHandler } from 'express';
import { calendarController } from '../controllers/calendar.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createCalendarEventSchema } from '../validators/calendar.validators';

const router = Router();

router.use(authenticate as RequestHandler);

router.post(
  '/',
  validate(createCalendarEventSchema),
  calendarController.createEvent as RequestHandler
);
router.get('/', calendarController.getEvents as RequestHandler);
router.get('/upcoming', calendarController.getUpcoming as RequestHandler);
router.get(
  '/application/:applicationId',
  calendarController.getByApplication as RequestHandler
);
router.delete('/:id', calendarController.deleteEvent as RequestHandler);

export default router;
