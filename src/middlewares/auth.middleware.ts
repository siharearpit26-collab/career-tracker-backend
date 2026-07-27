import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt.utils';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserModel } from '../models';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No access token provided');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new UnauthorizedError('No access token provided');
    }

    const decoded = verifyAccessToken(token);

    const user = await UserModel.findById(decoded.userId).select('-password -refreshTokens');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    next(error);
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isEmailVerified) {
    next(new ForbiddenError('Email verification required'));
    return;
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(new UnauthorizedError('Not authenticated'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
};
