import { Router, Request, Response } from 'express';
import { UserModel } from '../models';
import { config } from '../config';

const router = Router();

// One-time setup route — only works in development
router.post('/make-admin', async (req: Request, res: Response): Promise<void> => {
  if (config.app.isProduction) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const { email, setupKey } = req.body as { email: string; setupKey: string };

  if (setupKey !== 'careertracker-setup-2024') {
    res.status(403).json({ success: false, message: 'Invalid setup key' });
    return;
  }

  const user = await UserModel.findOneAndUpdate(
    { email },
    { $set: { role: 'admin', isEmailVerified: true } },
    { new: true }
  );

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.status(200).json({
    success: true,
    message: `User ${email} is now admin + email verified`,
    data: { id: user._id, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
  });
});

// Verify any user's email
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  if (config.app.isProduction) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const { email, setupKey } = req.body as { email: string; setupKey: string };

  if (setupKey !== 'careertracker-setup-2024') {
    res.status(403).json({ success: false, message: 'Invalid setup key' });
    return;
  }

  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        isEmailVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
      },
    },
    { new: true }
  );

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.status(200).json({
    success: true,
    message: `Email verified for ${email}`,
    data: { email: user.email, isEmailVerified: user.isEmailVerified },
  });
});

export default router;
