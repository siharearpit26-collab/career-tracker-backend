import { buildPaginatedResult } from '../../utils/pagination.utils';

describe('Pagination Utils', () => {
  describe('buildPaginatedResult', () => {
    it('should build correct pagination for first page', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = buildPaginatedResult(data, 50, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should set hasPrev true for non-first pages', () => {
      const result = buildPaginatedResult([], 50, {
        page: 3,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.hasNext).toBe(true);
    });

    it('should set hasNext false for last page', () => {
      const result = buildPaginatedResult([], 50, {
        page: 5,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should handle empty results', () => {
      const result = buildPaginatedResult([], 0, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should calculate totalPages correctly', () => {
      const result = buildPaginatedResult([], 25, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.pagination.totalPages).toBe(3); // ceil(25/10)
    });
  });
});
