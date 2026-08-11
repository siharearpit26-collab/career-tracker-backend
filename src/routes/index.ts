import { Router } from 'express';
import authRoutes from './auth.routes';
import applicationRoutes from './application.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import reminderRoutes from './reminder.routes';
import notificationRoutes from './notification.routes';
import adminRoutes from './admin.routes';
import profileRoutes from './profile.routes';
import setupRoutes from './setup.routes';
import emailRoutes from './email.routes';
import calendarRoutes from './calendar.routes';
import { discoveryAdminRoutes } from '../discovery/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/applications', applicationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/reminders', reminderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/profile', profileRoutes);
router.use('/setup', setupRoutes);
router.use('/email', emailRoutes);
router.use('/calendar', calendarRoutes);
router.use('/v1/admin/discovery', discoveryAdminRoutes);

export default router;
