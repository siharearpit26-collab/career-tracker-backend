import crypto from 'crypto';
import { UserModel } from '../models';
import { IUserDocument } from '../types';
import { RegisterDTO } from '../types/auth.types';

export class UserRepository {
  async findByEmail(email: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ email }).select(
      '+password +refreshTokens +emailVerificationToken +emailVerificationExpires +passwordResetToken +passwordResetExpires'
    );
  }

  async findById(id: string): Promise<IUserDocument | null> {
    return UserModel.findById(id);
  }

  async findByIdWithTokens(id: string): Promise<IUserDocument | null> {
    return UserModel.findById(id).select('+refreshTokens');
  }

  async create(data: RegisterDTO): Promise<IUserDocument> {
    return UserModel.create(data);
  }

  async update(
    id: string,
    data: Partial<IUserDocument>
  ): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async updateRaw(
    id: string,
    update: Record<string, unknown>
  ): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(id, update, { new: true });
  }

  async addRefreshToken(id: string, token: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $push: { refreshTokens: token },
    });
  }

  async removeRefreshToken(id: string, token: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $pull: { refreshTokens: token },
    });
  }

  async clearAllRefreshTokens(id: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $set: { refreshTokens: [] },
    });
  }

  async findByEmailVerificationToken(
    token: string
  ): Promise<IUserDocument | null> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return UserModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');
  }

  async findByPasswordResetToken(
    token: string
  ): Promise<IUserDocument | null> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');
  }

  async findAll(
    filter: Record<string, unknown> = {},
    skip = 0,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<IUserDocument[]> {
    return UserModel.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);
  }

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    return UserModel.countDocuments(filter);
  }

  async deactivate(id: string): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
  }

  async activate(id: string): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true }
    );
  }
}

export const userRepository = new UserRepository();
