import { userRepository } from '../repositories/user.repository';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.utils';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../utils/email.utils';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import {
  RegisterDTO,
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  TokenPair,
  UserResponseDTO,
} from '../types';

export class AuthService {
  private sanitizeUser(user: {
    _id: { toString(): string };
    firstName: string;
    lastName: string;
    email: string;
    role: 'user' | 'admin';
    profileImage?: string;
    resumeUrl?: string;
    isEmailVerified: boolean;
    preferences: {
      emailNotifications: boolean;
      reminderNotifications: boolean;
      weeklyDigest: boolean;
      theme: 'light' | 'dark' | 'system';
      language: string;
      timezone: string;
    };
    createdAt: Date;
  }): UserResponseDTO {
    return {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      resumeUrl: user.resumeUrl,
      isEmailVerified: user.isEmailVerified,
      preferences: user.preferences,
      createdAt: user.createdAt,
    };
  }

  async register(
    data: RegisterDTO
  ): Promise<{ user: UserResponseDTO; tokens: TokenPair }> {
    // Check if email already taken
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    // Create user
    const user = await userRepository.create(data);

    // Generate JWT tokens first (so response is fast)
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    await userRepository.addRefreshToken(
      user._id.toString(),
      tokens.refreshToken
    );

    // Send verification email in background (non-blocking)
    void (async () => {
      try {
        const verificationToken = user.generateEmailVerificationToken();
        await user.save();
        await sendVerificationEmail(user.email, verificationToken);
      } catch (emailError) {
        logger.warn('Failed to send verification email:', emailError);
      }
    })();

    // Send welcome email in background (non-blocking)
    void (async () => {
      try {
        await sendWelcomeEmail(user.email, user.firstName);
      } catch (emailError) {
        logger.warn('Failed to send welcome email:', emailError);
      }
    })();

    return { user: this.sanitizeUser(user), tokens };
  }

  async login(
    data: LoginDTO
  ): Promise<{ user: UserResponseDTO; tokens: TokenPair }> {
    // Find user with password
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isValid = await user.comparePassword(data.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    await userRepository.addRefreshToken(
      user._id.toString(),
      tokens.refreshToken
    );

    return { user: this.sanitizeUser(user), tokens };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await userRepository.removeRefreshToken(userId, refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await userRepository.clearAllRefreshTokens(userId);
  }

  async refreshToken(
    token: string
  ): Promise<{ user: UserResponseDTO; tokens: TokenPair }> {
    if (!token) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // Verify the refresh token signature and expiry
    const decoded = verifyRefreshToken(token);

    // Find user with their stored refresh tokens
    const user = await userRepository.findByIdWithTokens(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    // Check the token exists in the user's stored refresh tokens
    if (!user.refreshTokens?.includes(token)) {
      // Possible token reuse attack — clear all tokens for safety
      await userRepository.clearAllRefreshTokens(user._id.toString());
      throw new UnauthorizedError('Invalid refresh token — please log in again');
    }

    // Rotate refresh token — remove old, issue new
    await userRepository.removeRefreshToken(user._id.toString(), token);

    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await userRepository.addRefreshToken(
      user._id.toString(),
      tokens.refreshToken
    );

    return { user: this.sanitizeUser(user), tokens };
  }

  async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const user = await userRepository.findByEmail(data.email);

    // Always return success to prevent email enumeration attacks
    if (!user) return;

    try {
      const resetToken = user.generatePasswordResetToken();
      await user.save();
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new BadRequestError('Failed to send password reset email');
    }
  }

  async resetPassword(data: ResetPasswordDTO): Promise<void> {
    const user = await userRepository.findByPasswordResetToken(data.token);
    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // Update password and clear reset token
    user.password = data.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Invalidate all refresh tokens for security
    user.refreshTokens = [];

    await user.save();
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await userRepository.findByEmailVerificationToken(token);
    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    try {
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();
      await sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      logger.error('Failed to resend verification email:', error);
      throw new BadRequestError('Failed to send verification email');
    }
  }

  async changePassword(
    userId: string,
    data: ChangePasswordDTO
  ): Promise<void> {
    const user = await userRepository.findByEmail(
      (await userRepository.findById(userId))?.email ?? ''
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await user.comparePassword(data.currentPassword);
    if (!isValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    user.password = data.newPassword;
    // Invalidate all refresh tokens for security
    user.refreshTokens = [];
    await user.save();
  }

  async getMe(userId: string): Promise<UserResponseDTO> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.sanitizeUser(user);
  }
}

export const authService = new AuthService();
