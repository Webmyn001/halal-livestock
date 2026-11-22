import type { Request, Response } from 'express';
import { User, hashPassword, toPublicUser, type UserDoc } from '../models/User';
import { sendEmailVerification, sendPasswordReset } from '../services/authMessages';
import { consumeLink, issueToken } from '../services/verificationTokens';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { toE164 } from '../utils/phone';
import { signAccessToken } from '../utils/token';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '../validation/authSchemas';

function withToken(user: UserDoc) {
  return { user: toPublicUser(user), token: signAccessToken(user) };
}

/** Emails are matched lowercased; phone input is normalized to the stored E.164 form. */
function findByIdentifier(identifier: string) {
  const lookup = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { phoneNumber: toE164(identifier) };
  return User.findOne(lookup);
}

/**
 * A provider outage must not change the response, otherwise these endpoints become a way to
 * test which accounts exist. Failures are logged instead.
 */
async function deliver(message: Promise<unknown>): Promise<void> {
  try {
    await message;
  } catch (err) {
    logger.error('Notification delivery failed', err instanceof Error ? err.message : String(err));
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const { fullName, email, phoneNumber, password, role } = req.body as RegisterInput;

  const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] }).lean<{
    email: string;
  } | null>();

  if (existing) {
    throw ApiError.conflict(
      existing.email === email ? 'Email is already registered' : 'Phone number is already registered'
    );
  }

  const user = await User.create({
    fullName,
    email,
    phoneNumber,
    passwordHash: await hashPassword(password),
    role,
  });

  const token = await issueToken(user.id, 'email_verification');
  await deliver(sendEmailVerification(user, token));

  sendSuccess(res, withToken(user), 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = req.body as LoginInput;

  // An unparseable identifier simply finds nobody, so login never reveals which format is valid.
  const user = await findByIdentifier(identifier).select('+passwordHash');

  // Same message for unknown account and wrong password: do not leak which fields exist.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been suspended');
  }

  user.lastLogin = new Date();
  await user.save();

  sendSuccess(res, withToken(user));
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound('Account no longer exists');
  sendSuccess(res, { user: toPublicUser(user) });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as VerifyEmailInput;
  const userId = await consumeLink(token, 'email_verification');

  const user = await User.findById(userId);
  if (!user) throw ApiError.badRequest('That link no longer belongs to an account');

  user.isEmailVerified = true;
  await user.save();

  sendSuccess(res, { emailVerified: true });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as ForgotPasswordInput;
  const user = await findByIdentifier(identifier);

  if (user && !user.isEmailVerified) {
    const token = await issueToken(user.id, 'email_verification');
    await deliver(sendEmailVerification(user, token));
  }

  sendSuccess(res, { accepted: true }, 202);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as ForgotPasswordInput;
  const user = await findByIdentifier(identifier);

  if (user) {
    const token = await issueToken(user.id, 'password_reset');
    await deliver(sendPasswordReset(user, token));
  }

  // One answer whether or not the account exists.
  sendSuccess(res, { accepted: true }, 202);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordInput;
  const userId = await consumeLink(token, 'password_reset');

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.badRequest('That link no longer belongs to an account');

  user.passwordHash = await hashPassword(password);
  // Sessions are stateless JWTs, so this is what ends the ones issued before the reset.
  user.tokenVersion += 1;
  await user.save();

  sendSuccess(res, { passwordChanged: true });
}
