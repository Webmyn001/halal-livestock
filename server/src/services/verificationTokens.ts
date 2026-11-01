import { VerificationToken, type VerificationPurpose } from '../models/VerificationToken';
import { ApiError } from '../utils/ApiError';
import { hashToken, randomOtp, randomToken } from '../utils/crypto';

const LIFETIME_MINUTES: Record<VerificationPurpose, number> = {
  email_verification: 24 * 60,
  password_reset: 30,
  phone_otp: 10,
};

/** Enough for honest typos, not enough for a six digit search. */
const MAX_CODE_ATTEMPTS = 5;

const INVALID_LINK = 'That link is not valid, or it has already been used. Ask for a new one.';

export async function issueToken(userId: string, purpose: VerificationPurpose): Promise<string> {
  // One live token per purpose, so an older email or code dies the moment a new one is sent.
  await VerificationToken.deleteMany({ userId, purpose });
  const token = purpose === 'phone_otp' ? randomOtp() : randomToken();
  const expiresAt = new Date(Date.now() + LIFETIME_MINUTES[purpose] * 60_000);
  await VerificationToken.create({ userId, purpose, tokenHash: hashToken(token), expiresAt });
  return token;
}

/**
 * High entropy links are looked up by digest alone, because the person clicking a reset link
 * has no session and cannot say whose account it belongs to.
 */
export async function consumeLink(rawToken: string, purpose: VerificationPurpose): Promise<string> {
  const token = await VerificationToken.findOne({ purpose, tokenHash: hashToken(rawToken) });
  if (!token) throw ApiError.badRequest(INVALID_LINK);

  if (token.expiresAt.getTime() <= Date.now()) {
    await token.deleteOne();
    throw ApiError.badRequest(INVALID_LINK);
  }

  await token.deleteOne();
  return token.userId;
}

export async function consumeCode(userId: string, rawCode: string): Promise<void> {
  const token = await VerificationToken.findOne({ userId, purpose: 'phone_otp' });

  if (!token) throw ApiError.badRequest('Request a code before entering one');

  if (token.expiresAt.getTime() <= Date.now() || token.attempts >= MAX_CODE_ATTEMPTS) {
    await token.deleteOne();
    throw ApiError.badRequest('That code has expired. Request a new one.');
  }

  if (token.tokenHash !== hashToken(rawCode)) {
    token.attempts += 1;
    await token.save();
    throw ApiError.badRequest('That code is not right.');
  }

  await token.deleteOne();
}
