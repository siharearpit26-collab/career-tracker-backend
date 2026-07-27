import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.patch('/preferences', profileController.updatePreferences);
router.post('/upload-image', uploadSingle('file'), profileController.uploadProfileImage);
router.post('/upload-resume', uploadSingle('file'), profileController.uploadResume);

export default router;
