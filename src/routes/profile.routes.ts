import { Router, RequestHandler } from 'express';
import { profileController } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate as RequestHandler);

router.get('/', profileController.getProfile as RequestHandler);
router.put('/', profileController.updateProfile as RequestHandler);
router.patch('/preferences', profileController.updatePreferences as RequestHandler);
router.post('/upload-image', uploadSingle('file'), profileController.uploadProfileImage as RequestHandler);
router.post('/upload-resume', uploadSingle('file'), profileController.uploadResume as RequestHandler);

export default router;
