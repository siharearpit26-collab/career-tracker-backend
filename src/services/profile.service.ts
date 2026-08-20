import { userRepository } from '../repositories/user.repository';
import { IUserDocument, UserResponseDTO, UserProfileDTO } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class ProfileService {
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

  async getProfile(userId: string): Promise<UserResponseDTO> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    data: UserProfileDTO
  ): Promise<UserResponseDTO> {
    const user = await userRepository.update(
      userId,
      data as Partial<IUserDocument>
    );
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async updateProfileImage(
    userId: string,
    imageUrl: string
  ): Promise<UserResponseDTO> {
    const user = await userRepository.update(userId, {
      profileImage: imageUrl,
    } as Partial<IUserDocument>);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async updateResume(
    userId: string,
    resumeUrl: string
  ): Promise<UserResponseDTO> {
    const user = await userRepository.update(userId, {
      resumeUrl,
    } as Partial<IUserDocument>);
    if (!user) throw new NotFoundError('User not found');
    return this.sanitizeUser(user);
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<IUserDocument['preferences']>
  ): Promise<UserResponseDTO> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    // Use dot notation to update individual preference fields
    const updateData: Record<string, unknown> = {};
    Object.entries(preferences).forEach(([key, value]) => {
      updateData[`preferences.${key}`] = value;
    });

    const updated = await userRepository.updateRaw(userId, { $set: updateData });
    if (!updated) throw new NotFoundError('User not found');
    return this.sanitizeUser(updated);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findByEmail(
      (await userRepository.findById(userId))?.email ?? ''
    );
    if (!user) throw new NotFoundError('User not found');

    const isValid = await user.comparePassword(password);
    if (!isValid) throw new BadRequestError('Incorrect password');

    await userRepository.deactivate(userId);
  }

  async getJobPreferences(userId: string): Promise<Record<string, unknown>> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return (user as unknown as Record<string, unknown>)['jobPreferences'] as Record<string, unknown> ?? {};
  }

  async updateJobPreferences(
    userId: string,
    data: {
      preferredRoles?: string[];
      skills?: string[];
      experienceYears?: number;
      preferredLocations?: string[];
      preferredWorkArrangement?: string[];
      salaryExpectation?: number;
      salaryCurrency?: string;
    }
  ): Promise<Record<string, unknown>> {
    const updateData: Record<string, unknown> = {};

    if (data.preferredRoles !== undefined) updateData['jobPreferences.preferredRoles'] = data.preferredRoles;
    if (data.skills !== undefined) updateData['jobPreferences.skills'] = data.skills;
    if (data.experienceYears !== undefined) updateData['jobPreferences.experienceYears'] = data.experienceYears;
    if (data.preferredLocations !== undefined) updateData['jobPreferences.preferredLocations'] = data.preferredLocations;
    if (data.preferredWorkArrangement !== undefined) updateData['jobPreferences.preferredWorkArrangement'] = data.preferredWorkArrangement;
    if (data.salaryExpectation !== undefined) updateData['jobPreferences.salaryExpectation'] = data.salaryExpectation;
    if (data.salaryCurrency !== undefined) updateData['jobPreferences.salaryCurrency'] = data.salaryCurrency;

    const user = await userRepository.updateRaw(userId, { $set: updateData });
    if (!user) throw new NotFoundError('User not found');
    return (user as unknown as Record<string, unknown>)['jobPreferences'] as Record<string, unknown> ?? {};
  }
}

export const profileService = new ProfileService();
