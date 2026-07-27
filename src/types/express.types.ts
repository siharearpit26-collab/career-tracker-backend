import { Request } from 'express';
import { IUserDocument } from './user.types';

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
  userId?: string;
}

export interface PaginatedRequest extends Request {
  query: {
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    search?: string;
    [key: string]: string | undefined;
  };
}
