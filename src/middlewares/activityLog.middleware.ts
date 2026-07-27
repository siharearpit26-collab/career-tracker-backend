import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { ActivityLogModel } from '../models';
import { logger } from '../utils/logger';

interface LogActivityOptions {
  action: string;
  entity?: string;
  getEntityId?: (req: AuthenticatedRequest) => string | undefined;
}

export const logActivity = (options: LogActivityOptions) => {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const entityId = options.getEntityId?.(req);

      await ActivityLogModel.create({
        userId: req.userId,
        action: options.action,
        entity: options.entity,
        entityId: entityId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        level: 'info',
      });
    } catch (error) {
      logger.warn('Failed to log activity:', error);
    }

    next();
  };
};
