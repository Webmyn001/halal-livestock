import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { env } from '../config/env';

export const USER_ROLES = ['buyer', 'farmer', 'driver', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const KYC_STATUSES = ['none', 'submitted', 'approved', 'rejected'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ID_TYPES = ['nin', 'passport', 'drivers_license', 'vusv'] as const;
export type IdType = (typeof ID_TYPES)[number];

export interface IFarmerProfile {
  farmName?: string;
  businessName?: string;
  address?: string;
  town?: string;
  state?: string;
  idType?: IdType;
  idNumber?: string;
  /** Optional. Only registered businesses have one. */
  cacNumber?: string;
  bankName?: string;
  accountName?: string;
  /** Stored as digits only. It is read back masked to anyone but the account owner. */
  accountNumber?: string;
  documentUrl?: string;
  documentPublicId?: string;
  status: KycStatus;
  reviewNote?: string;
  reviewedAt?: Date;
}

export interface IUser {
  email: string;
  phoneNumber: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  /** Bumped whenever a session must die immediately, e.g. after a password reset. */
  tokenVersion: number;
  farmerProfile?: IFarmerProfile;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const farmerProfileSchema = new Schema<IFarmerProfile>(
  {
    farmName: { type: String, trim: true, maxlength: 120 },
    businessName: { type: String, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 200 },
    town: { type: String, trim: true, maxlength: 60 },
    state: { type: String, trim: true, maxlength: 60 },
    idType: { type: String, enum: ID_TYPES },
    idNumber: { type: String, trim: true, maxlength: 40 },
    cacNumber: { type: String, trim: true, maxlength: 40 },
    bankName: { type: String, trim: true, maxlength: 60 },
    accountName: { type: String, trim: true, maxlength: 120 },
    accountNumber: { type: String, trim: true, maxlength: 20 },
    documentUrl: String,
    documentPublicId: String,
    status: { type: String, enum: KYC_STATUSES, default: 'none' },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    reviewedAt: Date,
  },
  { _id: false }
);

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phoneNumber: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    farmerProfile: farmerProfileSchema,
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (this: UserDoc, candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

/** Digits kept visible only enough to recognise the account, never enough to pay it out. */
export function maskAccountNumber(accountNumber?: string): string | undefined {
  if (!accountNumber) return undefined;
  return `••••${accountNumber.slice(-4)}`;
}

export function toPublicFarmerProfile(profile?: IFarmerProfile) {
  if (!profile) return null;
  return {
    farmName: profile.farmName,
    businessName: profile.businessName,
    address: profile.address,
    town: profile.town,
    state: profile.state,
    idType: profile.idType,
    idNumber: profile.idNumber,
    cacNumber: profile.cacNumber,
    bankName: profile.bankName,
    accountName: profile.accountName,
    accountNumber: maskAccountNumber(profile.accountNumber),
    documentUrl: profile.documentUrl,
    status: profile.status,
    reviewNote: profile.reviewNote,
    reviewedAt: profile.reviewedAt,
  };
}

/** Shape sent back to the client — passwordHash is never selected or serialized. */
export function toPublicUser(user: UserDoc) {
  return {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    /** Payouts need more than a verified phone, so the two states are reported apart. */
    isKycApproved: user.farmerProfile?.status === 'approved',
    isActive: user.isActive,
    farmerProfile: toPublicFarmerProfile(user.farmerProfile),
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

export const User = model<IUser, UserModel>('User', userSchema);
