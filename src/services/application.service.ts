import { Types } from 'mongoose';
import { applicationRepository } from '../repositories/application.repository';
import {
  CreateApplicationDTO,
  UpdateApplicationDTO,
  ApplicationFilterOptions,
  PaginatedResult,
  IApplicationDocument,
} from '../types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { buildPaginatedResult } from '../utils/pagination.utils';

export class ApplicationService {
  async createApplication(
    userId: string,
    data: CreateApplicationDTO
  ): Promise<IApplicationDocument> {
    return applicationRepository.create(userId, data);
  }

  async getApplicationById(
    id: string,
    userId: string
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    const application = await applicationRepository.findByIdAndUserId(id, userId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  }

  async getApplications(
    userId: string,
    filters: ApplicationFilterOptions,
    pagination: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }
  ): Promise<PaginatedResult<IApplicationDocument>> {
    const { data, total } = await applicationRepository.findByUserId(
      userId,
      filters,
      pagination
    );

    return buildPaginatedResult(data, total, pagination);
  }

  async updateApplication(
    id: string,
    userId: string,
    data: UpdateApplicationDTO
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    // Validate salary range
    if (
      data.salaryMin !== undefined &&
      data.salaryMax !== undefined &&
      data.salaryMin > data.salaryMax
    ) {
      throw new BadRequestError('Minimum salary cannot exceed maximum salary');
    }

    const application = await applicationRepository.update(id, userId, data);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  }

  async deleteApplication(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    // Verify ownership first
    const existing = await applicationRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      throw new NotFoundError('Application not found');
    }

    const deleted = await applicationRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Application not found');
    }
  }

  async archiveApplication(
    id: string,
    userId: string
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    const application = await applicationRepository.update(id, userId, {
      isArchived: true,
    });
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  }

  async unarchiveApplication(
    id: string,
    userId: string
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    const application = await applicationRepository.update(id, userId, {
      isArchived: false,
    });
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  }

  async updateStatus(
    id: string,
    userId: string,
    status: string
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    const validStatuses = [
      'Applied',
      'Shortlisted',
      'Interview Scheduled',
      'Interview Completed',
      'Offer',
      'Rejected',
      'Withdrawn',
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    const application = await applicationRepository.update(id, userId, {
      status: status as UpdateApplicationDTO['status'],
    });
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  }

  async addInterviewStage(
    id: string,
    userId: string,
    stage: {
      type: 'Phone Screen' | 'Technical' | 'HR' | 'On-site' | 'Final' | 'Other';
      date?: Date;
      notes?: string;
      outcome?: 'Passed' | 'Failed' | 'Pending' | 'Cancelled';
    }
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid application ID');
    }

    const application = await applicationRepository.findByIdAndUserId(id, userId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    application.interviewStages.push(stage);
    await application.save();

    return application;
  }

  async getStats(userId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    archived: number;
  }> {
    const [total, byStatus, bySource, archived] = await Promise.all([
      applicationRepository.getTotalCount(userId, false),
      applicationRepository.countByStatus(userId),
      applicationRepository.countBySource(userId),
      applicationRepository.getTotalCount(userId, true),
    ]);

    return { total, byStatus, bySource, archived };
  }
}

export const applicationService = new ApplicationService();
