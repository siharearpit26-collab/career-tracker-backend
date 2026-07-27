import { Router, RequestHandler } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  authRateLimiter,
  passwordResetRateLimiter,
} from '../middlewares/rateLimiter.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  refreshTokenSchema,
} from '../validators/auth.validators';

const router = Router();

// Public routes
router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refresh
);

router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail
);

// Protected routes
router.post('/logout', authenticate as RequestHandler, authController.logout as RequestHandler);

router.post('/logout-all', authenticate as RequestHandler, authController.logoutAll as RequestHandler);

router.post(
  '/resend-verification',
  authenticate as RequestHandler,
  authController.resendVerification as RequestHandler
);

router.post(
  '/change-password',
  authenticate as RequestHandler,
  validate(changePasswordSchema),
  authController.changePassword as RequestHandler
);

router.get('/me', authenticate as RequestHandler, authController.getMe as RequestHandler);

export default router;
