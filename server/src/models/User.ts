import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { env } from '../config/env';

export const USER_ROLES = ['buyer', 'farmer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUserPhoto {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
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
  /** Farm and stock photos. The upload endpoint keeps the list inside its size limit. */
  photos: IUserPhoto[];
  /** Bumped whenever a session must die immediately, e.g. after a password reset. */
  tokenVersion: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const photoSchema = new Schema<IUserPhoto>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    bytes: { type: Number, required: true },
    format: { type: String, required: true },
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
    photos: { type: [photoSchema], default: [] },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
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
    photos: user.photos,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

export const User = model<IUser, UserModel>('User', userSchema);
