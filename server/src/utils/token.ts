import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserDoc } from '../models/User';

export function signAccessToken(user: UserDoc): string {
  return jwt.sign({ userId: user.id, role: user.role, tokenVersion: user.tokenVersion ?? 0 }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}
