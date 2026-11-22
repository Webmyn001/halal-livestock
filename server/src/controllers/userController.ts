import type { Request, Response } from 'express';
import { User, toPublicUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import type { UpdateProfileInput } from '../validation/authSchemas';

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { fullName, phoneNumber } = req.body as UpdateProfileInput;

  // Object-level authorization: a user may only ever edit their own profile.
  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound('Account no longer exists');

  if (fullName !== undefined) user.fullName = fullName;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

  await user.save();

  sendSuccess(res, { user: toPublicUser(user) });
}
