import { Router, RequestHandler } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate as RequestHandler);

router.get('/unread-count', notificationController.getUnreadCount as RequestHandler);
router.get('/', notificationController.getAll as RequestHandler);
router.patch('/read-all', notificationController.markAllAsRead as RequestHandler);
router.delete('/', notificationController.deleteAll as RequestHandler);
router.patch('/:id/read', notificationController.markAsRead as RequestHandler);
router.delete('/:id', notificationController.delete as RequestHandler);

export default router;
