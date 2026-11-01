import type { Request, Response } from 'express';
import { VerificationToken } from '../models/VerificationToken';
import { User, toPublicUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import type { UpdateProfileInput } from '../validation/authSchemas';

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { fullName, phoneNumber } = req.body as UpdateProfileInput;

  // Object-level authorization: a user may only ever edit their own profile.
  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound('Account no longer exists');

  const numberChanged = phoneNumber !== undefined && phoneNumber !== user.phoneNumber;

  if (fullName !== undefined) user.fullName = fullName;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
  if (numberChanged) {
    // A new number has never been seen by us, so it starts over as unverified.
    user.isPhoneVerified = false;
  }

  await user.save();

  // Any code sent to the old number must stop working.
  if (numberChanged) {
    await VerificationToken.deleteMany({ userId: user.id, purpose: 'phone_otp' });
  }

  sendSuccess(res, { user: toPublicUser(user) });
}
