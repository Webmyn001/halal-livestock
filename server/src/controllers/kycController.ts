import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { toPublicFarmerProfile, User } from '../models/User';
import { deleteImage, kycFolder, MAX_TOTAL_BYTES, storeImage } from '../services/imageStore';
import { submitKycSchema, type SubmitKycInput } from '../validation/kycSchemas';

function fileOf(value: unknown): Express.Multer.File | undefined {
  return value && !Array.isArray(value) ? (value as Express.Multer.File) : undefined;
}

/**
 * A farmer with no approved details cannot be paid out, so this is the gate the settlement ledger
 * leans on. Rejected submissions can be corrected and sent again.
 */
export async function submitKyc(req: Request, res: Response): Promise<void> {
  const input = req.body as SubmitKycInput;
  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.unauthorized('This account no longer exists');

  const current = user.farmerProfile;
  if (current?.status === 'submitted') throw ApiError.conflict('Your details are already with the verification team');
  if (current?.status === 'approved') throw ApiError.conflict('Your farm is already verified');

  const document = fileOf(req.file);
  if (document && document.size > MAX_TOTAL_BYTES) {
    throw ApiError.badRequest('That document photo is too large. Take another one or shrink it below 3 MB.');
  }

  let documentUrl = current?.documentUrl;
  let documentPublicId = current?.documentPublicId;

  if (document) {
    if (documentPublicId) await deleteImage(documentPublicId, kycFolder(user.id)).catch(() => undefined);
    const stored = await storeImage(document, kycFolder(user.id)).catch(() => {
      throw new ApiError(502, 'UPLOAD_FAILED', 'The image service refused that document. Try again in a moment.');
    });
    documentUrl = stored.url;
    documentPublicId = stored.publicId;
  }

  user.farmerProfile = {
    ...input,
    documentUrl,
    documentPublicId,
    status: 'submitted',
    reviewNote: undefined,
    reviewedAt: undefined,
  };

  await user.save();
  logger.info('KYC submitted', { userId: user.id, hasDocument: Boolean(documentUrl) });

  sendSuccess(res, { farmerProfile: toPublicFarmerProfile(user.farmerProfile) });
}

export async function withdrawDocument(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.userId);
  const profile = user?.farmerProfile;
  if (!user || !profile) throw ApiError.notFound('You have not sent your details yet');
  if (!profile.documentPublicId) throw ApiError.notFound('There is no document on your account');

  await deleteImage(profile.documentPublicId, kycFolder(user.id));
  profile.documentUrl = undefined;
  profile.documentPublicId = undefined;
  await user.save();

  sendSuccess(res, { farmerProfile: toPublicFarmerProfile(user.farmerProfile) });
}
