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
    // verifyToken reports a bad session by calling next(err), which lands here as its first
    // argument. Without that check a missing token would be swallowed and answered as a role
    // problem instead of a sign in problem.
    void verifyToken(req, res, (authError?: unknown) => {
      if (authError) {
        next(authError);
        return;
      }
      if (!req.user || !roles.includes(req.user.role)) {
        next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
        return;
      }
      next();
    });
  };
}

/**
 * For a router that already ran verifyToken on every request. Checking the role again through
 * requireRole would read the account from the database twice per call.
 */
export function requireSessionRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}

/** The review team only reads submissions from an address we know belongs to the farmer. */
export const requireEmailVerified: RequestHandler = async (req, _res, next) => {
  if (!req.user) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  const account = await User.findById(req.user.userId).select('isEmailVerified').lean();
  if (!account) {
    next(ApiError.unauthorized('This account can no longer be used'));
    return;
  }
  if (!account.isEmailVerified) {
    next(ApiError.forbidden('Confirm your email address before sending your farm details for review.'));
    return;
  }

  next();
};
