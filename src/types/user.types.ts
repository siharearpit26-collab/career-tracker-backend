import { Document, Types } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: UserRole;
  profileImage?: string;
  resumeUrl?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  googleId?: string;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokens: string[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  emailNotifications: boolean;
  reminderNotifications: boolean;
  weeklyDigest: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  comparePassword(password: string): Promise<boolean>;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
}

export interface UserProfileDTO {
  firstName: string;
  lastName: string;
  profileImage?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserResponseDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  resumeUrl?: string;
  isEmailVerified: boolean;
  preferences: UserPreferences;
  createdAt: Date;
}
