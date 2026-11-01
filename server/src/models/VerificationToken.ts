import { Schema, model, type HydratedDocument } from 'mongoose';

export const VERIFICATION_PURPOSES = ['email_verification', 'password_reset', 'phone_otp'] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];

export interface IVerificationToken {
  userId: string;
  purpose: VerificationPurpose;
  tokenHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export type VerificationTokenDoc = HydratedDocument<IVerificationToken>;

const verificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: { type: String, required: true, index: true },
    purpose: { type: String, enum: VERIFICATION_PURPOSES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

// Mongo removes expired rows on its own, so abandoned links do not pile up.
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationToken = model<IVerificationToken>('VerificationToken', verificationTokenSchema);
