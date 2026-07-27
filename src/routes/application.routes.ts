import { Router, RequestHandler } from 'express';
import { applicationController } from '../controllers/application.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createApplicationSchema,
  updateApplicationSchema,
  addInterviewStageSchema,
} from '../validators/application.validators';

const router = Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Stats route (must be before /:id to avoid conflict)
router.get('/stats', applicationController.getStats as RequestHandler);

// CRUD routes
router.get('/', applicationController.getAll as RequestHandler);
router.post('/', validate(createApplicationSchema), applicationController.create as RequestHandler);
router.get('/:id', applicationController.getById as RequestHandler);
router.put('/:id', validate(updateApplicationSchema), applicationController.update as RequestHandler);
router.delete('/:id', applicationController.delete as RequestHandler);

// Status & archive routes
router.patch('/:id/status', applicationController.updateStatus as RequestHandler);
router.patch('/:id/archive', applicationController.archive as RequestHandler);
router.patch('/:id/unarchive', applicationController.unarchive as RequestHandler);

// Interview stages
router.post(
  '/:id/interview-stages',
  validate(addInterviewStageSchema),
  applicationController.addInterviewStage as RequestHandler
);

export default router;
