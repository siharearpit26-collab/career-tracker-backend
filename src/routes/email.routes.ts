import { Router, RequestHandler } from 'express';
import { emailController } from '../controllers/email.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  connectEmailSchema,
  confirmClassificationSchema,
} from '../validators/email.validators';

const router = Router();

router.use(authenticate as RequestHandler);

// OAuth
router.get('/auth/:provider', emailController.getAuthUrl as RequestHandler);
router.post(
  '/connect/:provider',
  validate(connectEmailSchema),
  emailController.connectAccount as RequestHandler
);

// Account management
router.get('/accounts', emailController.getAccounts as RequestHandler);
router.patch('/accounts/:id/disconnect', emailController.disconnectAccount as RequestHandler);
router.delete('/accounts/:id', emailController.deleteAccount as RequestHandler);

// Sync
router.post('/sync', emailController.syncAll as RequestHandler);
router.post('/sync/:id', emailController.syncAccount as RequestHandler);
router.get('/sync/history', emailController.getSyncHistory as RequestHandler);

// Classifications
router.get('/classifications', emailController.getClassifications as RequestHandler);
router.post(
  '/classifications/:id/confirm',
  validate(confirmClassificationSchema),
  emailController.confirmClassification as RequestHandler
);

export default router;
