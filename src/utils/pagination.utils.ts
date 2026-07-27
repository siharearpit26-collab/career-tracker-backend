import { PaginatedResult, PaginationOptions } from '../types';
import { config } from '../config';

export const getPaginationOptions = (query: {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}): PaginationOptions => {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(
    config.pagination.maxPageSize,
    Math.max(1, parseInt(query.limit ?? String(config.pagination.defaultPageSize), 10))
  );
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    sortBy,
    sortOrder,
  };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> => {
  const totalPages = Math.ceil(total / options.limit);
  const hasNext = options.page < totalPages;
  const hasPrev = options.page > 1;

  return {
    data,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
};

export const calculateSkip = (page: number, limit: number): number => {
  return (page - 1) * limit;
};
