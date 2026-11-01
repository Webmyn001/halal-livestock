import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { User, type UserRole } from '../models/User';

interface TokenPayload {
  userId: string;
  role: UserRole;
  tokenVersion?: number;
}

/**
 * The token is only a claim, so every request checks it against the account. Without that,
 * a suspended user or a password reset would leave already issued tokens working until expiry.
 */
export const verifyToken: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized('Missing bearer token'));
    return;
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as unknown as TokenPayload;
  } catch {
    next(ApiError.unauthorized('Invalid or expired session'));
    return;
  }

  if (!payload.userId || !payload.role) {
    next(ApiError.unauthorized('Malformed session token'));
    return;
  }

  // lean() skips schema defaults, and accounts created before tokenVersion existed have no
  // stored value, hence the ?? 0 fallback on the account side.
  const account = await User.findById(payload.userId).select('role isActive tokenVersion').lean();
  if (!account || !account.isActive) {
    next(ApiError.unauthorized('This account can no longer be used'));
    return;
  }

  if ((payload.tokenVersion ?? -1) !== (account.tokenVersion ?? 0)) {
    next(ApiError.unauthorized('Your session ended. Sign in again.'));
    return;
  }

  req.user = { userId: payload.userId, role: account.role };
  next();
};

/**
 * Lets a request through without a user when no Authorization header is sent, but still
 * rejects a present-but-broken token so a stale session never masquerades as a guest.
 */
export const attachUserIfPresent: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) {
    next();
    return;
  }
  void verifyToken(req, res, next);
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    void verifyToken(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
        return;
      }
      next();
    });
  };
}
