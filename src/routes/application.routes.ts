import { Router } from 'express';
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
router.use(authenticate);

// Stats route (must be before /:id to avoid conflict)
router.get('/stats', applicationController.getStats);

// CRUD routes
router.get('/', applicationController.getAll);
router.post('/', validate(createApplicationSchema), applicationController.create);
router.get('/:id', applicationController.getById);
router.put('/:id', validate(updateApplicationSchema), applicationController.update);
router.delete('/:id', applicationController.delete);

// Status & archive routes
router.patch('/:id/status', applicationController.updateStatus);
router.patch('/:id/archive', applicationController.archive);
router.patch('/:id/unarchive', applicationController.unarchive);

// Interview stages
router.post(
  '/:id/interview-stages',
  validate(addInterviewStageSchema),
  applicationController.addInterviewStage
);

export default router;
