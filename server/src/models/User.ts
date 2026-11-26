import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types/index.js';

export interface IRefreshTokenEntry {
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  createdAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  resetPasswordTokenHash?: string;
  resetPasswordExpires?: Date;
  refreshTokens: IRefreshTokenEntry[];
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshTokenEntry>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'company_owner', 'company_admin', 'rental_staff', 'customer'],
      default: 'customer',
      required: true,
    },
    avatarUrl: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, active: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
