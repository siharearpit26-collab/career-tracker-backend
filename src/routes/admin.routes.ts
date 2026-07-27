import { Router, RequestHandler } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate as RequestHandler);
router.use(authorize('admin') as RequestHandler);

router.get('/stats', adminController.getSystemStats as RequestHandler);
router.get('/users', adminController.getAllUsers as RequestHandler);
router.get('/users/:id', adminController.getUserById as RequestHandler);
router.patch('/users/:id/deactivate', adminController.deactivateUser as RequestHandler);
router.patch('/users/:id/activate', adminController.activateUser as RequestHandler);
router.patch('/users/:id/role', adminController.updateUserRole as RequestHandler);
router.delete('/users/:id', adminController.deleteUser as RequestHandler);
router.get('/logs', adminController.getActivityLogs as RequestHandler);

export default router;
