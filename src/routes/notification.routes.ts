import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.getAll);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/', notificationController.deleteAll);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.delete);

export default router;
