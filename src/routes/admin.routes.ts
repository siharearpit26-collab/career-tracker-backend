import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', adminController.getSystemStats);
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/deactivate', adminController.deactivateUser);
router.patch('/users/:id/activate', adminController.activateUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/logs', adminController.getActivityLogs);

export default router;
