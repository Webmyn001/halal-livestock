import { VerificationToken, type VerificationPurpose } from '../models/VerificationToken';
import { ApiError } from '../utils/ApiError';
import { hashToken, randomToken } from '../utils/crypto';

const LIFETIME_MINUTES: Record<VerificationPurpose, number> = {
  email_verification: 24 * 60,
  password_reset: 30,
};

const INVALID_LINK = 'That link is not valid, or it has already been used. Ask for a new one.';

export async function issueToken(userId: string, purpose: VerificationPurpose): Promise<string> {
  // One live token per purpose, so an older email or code dies the moment a new one is sent.
  await VerificationToken.deleteMany({ userId, purpose });
  const token = randomToken();
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
