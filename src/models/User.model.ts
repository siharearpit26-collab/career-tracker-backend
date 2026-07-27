import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { IUserDocument, UserPreferences } from '../types';

const userPreferencesSchema = new Schema<UserPreferences>(
  {
    emailNotifications: { type: Boolean, default: true },
    reminderNotifications: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false }
);

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         isEmailVerified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */
const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    profileImage: { type: String },
    resumeUrl: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    googleId: { type: String, sparse: true },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const record = ret as Record<string, unknown>;
        record['id'] = record['_id'];
        delete record['_id'];
        delete record['__v'];
        delete record['password'];
        delete record['refreshTokens'];
        delete record['emailVerificationToken'];
        delete record['emailVerificationExpires'];
        delete record['passwordResetToken'];
        delete record['passwordResetExpires'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });

// Pre-save hook for password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance methods
userSchema.methods['comparePassword'] = async function (
  password: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

userSchema.methods['generateEmailVerificationToken'] = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

userSchema.methods['generatePasswordResetToken'] = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  return token;
};

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const UserModel = mongoose.model<IUserDocument>('User', userSchema);

export default UserModel;
