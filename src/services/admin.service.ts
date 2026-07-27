import { userRepository } from '../repositories/user.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { ActivityLogModel } from '../models';
import { buildPaginatedResult } from '../utils/pagination.utils';
import { NotFoundError } from '../utils/errors';
import { IUserDocument, PaginatedResult, UserResponseDTO } from '../types';
import { Types } from 'mongoose';
import { ApplicationModel, UserModel } from '../models';

export class AdminService {
  private sanitizeUser(user: IUserDocument): UserResponseDTO {
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

  async getAllUsers(
    page = 1,
    limit = 10,
    search?: string,
    role?: string,
    isActive?: boolean
  ): Promise<PaginatedResult<UserResponseDTO>> {
    const filter: Record<string, unknown> = {};

    if (search) {
      filter['$or'] = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) filter['role'] = role;
    if (isActive !== undefined) filter['isActive'] = isActive;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      userRepository.findAll(filter, skip, limit, 'createdAt', 'desc'),
      userRepository.countDocuments(filter),
    ]);

    const sanitized = users.map((u) => this.sanitizeUser(u));
    return buildPaginatedResult(sanitized, total, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async getUserById(id: string): Promise<UserResponseDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('User not found');
    }
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async deactivateUser(id: string): Promise<UserResponseDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('User not found');
    }
    const user = await userRepository.deactivate(id);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async activateUser(id: string): Promise<UserResponseDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('User not found');
    }
    const user = await userRepository.activate(id);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async updateUserRole(
    id: string,
    role: 'user' | 'admin'
  ): Promise<UserResponseDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('User not found');
    }
    const user = await userRepository.update(id, { role } as Partial<IUserDocument>);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async getSystemStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalApplications: number;
    newUsersThisMonth: number;
    newApplicationsThisMonth: number;
    usersByRole: Record<string, number>;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      totalApplications,
      newUsersThisMonth,
      newApplicationsThisMonth,
      usersByRole,
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ isActive: true }),
      ApplicationModel.countDocuments(),
      UserModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      ApplicationModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      UserModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const roleMap: Record<string, number> = {};
    (usersByRole as Array<{ _id: string; count: number }>).forEach((r) => {
      roleMap[r._id] = r.count;
    });

    return {
      totalUsers,
      activeUsers,
      totalApplications,
      newUsersThisMonth,
      newApplicationsThisMonth,
      usersByRole: roleMap,
    };
  }

  async getActivityLogs(
    page = 1,
    limit = 20,
    userId?: string,
    level?: string
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {};
    if (userId && Types.ObjectId.isValid(userId)) {
      filter['userId'] = new Types.ObjectId(userId);
    }
    if (level) filter['level'] = level;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email'),
      ActivityLogModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(logs, total, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async deleteUser(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('User not found');
    }
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');

    // Delete user and all their data
    await Promise.all([
      UserModel.findByIdAndDelete(id),
      ApplicationModel.deleteMany({ userId: new Types.ObjectId(id) }),
      notificationRepository.deleteAll(id),
    ]);
  }
}

export const adminService = new AdminService();
