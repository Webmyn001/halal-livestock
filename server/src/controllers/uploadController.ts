import type { Request, Response } from 'express';
import { User, toPublicUser, type IUserPhoto } from '../models/User';
import { deleteImage, MAX_IMAGE_FILES, MAX_TOTAL_BYTES, storeImage } from '../services/imageStore';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import type { RemoveImageInput } from '../validation/uploadSchemas';

const MEGABYTE = 1024 * 1024;

function asFiles(value: unknown): Express.Multer.File[] {
  if (Array.isArray(value)) return value as Express.Multer.File[];
  return value ? [value as Express.Multer.File] : [];
}

export async function uploadImages(req: Request, res: Response): Promise<void> {
  const files = asFiles(req.files);

  if (files.length === 0) throw ApiError.badRequest('Choose at least one image');
  if (files.length > MAX_IMAGE_FILES) {
    throw ApiError.badRequest(`Select no more than ${MAX_IMAGE_FILES} images at a time`);
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw ApiError.badRequest(
      `That selection is ${(totalBytes / MEGABYTE).toFixed(1)} MB. Keep the set under ${MAX_TOTAL_BYTES / MEGABYTE} MB.`
    );
  }

  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound('Account no longer exists');

  const room = MAX_IMAGE_FILES - user.photos.length;
  if (room <= 0) {
    throw ApiError.badRequest(`You already have ${MAX_IMAGE_FILES} images. Remove one before adding another.`);
  }
  if (files.length > room) {
    throw ApiError.badRequest(`You can add ${room} more ${room === 1 ? 'image' : 'images'}. Remove one first.`);
  }

  const stored: IUserPhoto[] = [];
  try {
    for (const file of files) {
      const image = await storeImage(file, user.id);
      stored.push(image);
      user.photos.push(image);
    }
  } catch (err) {
    // A half finished set would leave files in storage that nothing points at.
    await Promise.allSettled(stored.map((image) => deleteImage(image.publicId, user.id)));
    logger.error('Image storage rejected the upload', err instanceof Error ? err.message : err);
    throw new ApiError(502, 'UPLOAD_FAILED', 'The image service refused that upload. Try again in a moment.');
  }

  await user.save();
  sendSuccess(res, { photos: toPublicUser(user).photos }, 201);
}

export async function removeImage(req: Request, res: Response): Promise<void> {
  const { publicId } = req.body as RemoveImageInput;

  const user = await User.findById(req.user!.userId);
  if (!user) throw ApiError.notFound('Account no longer exists');

  // The account's own list is the authorisation record: a key that is not on it cannot be deleted.
  if (!user.photos.some((photo) => photo.publicId === publicId)) {
    throw ApiError.notFound('That image is not on your account');
  }

  await deleteImage(publicId, user.id);
  user.photos = user.photos.filter((photo) => photo.publicId !== publicId);
  await user.save();

  sendSuccess(res, { photos: toPublicUser(user).photos });
}
