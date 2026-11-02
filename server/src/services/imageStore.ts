import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export const MAX_IMAGE_FILES = 4;
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface StoredImage {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const CLOUDINARY_ROOT = 'halal-livestocks';

export const LOCAL_UPLOAD_ROOT = resolve(process.cwd(), env.UPLOAD_DIR);

/** Where a farmer's listing photos live. Every key is built from this, so it is also the guard. */
export function listingFolder(farmerId: string): string {
  return `listings/${farmerId}`;
}

/** Evidence on a dispute, kept apart from the listing so a takedown does not delete the proof. */
export function disputeFolder(userId: string): string {
  return `disputes/${userId}`;
}

/** The identity document a farmer uploads once during verification. */
export function kycFolder(userId: string): string {
  return `kyc/${userId}`;
}

function ownedPrefix(folder: string): string {
  return env.STORAGE_PROVIDER === 'cloudinary' ? `${CLOUDINARY_ROOT}/${folder}` : folder;
}

if (env.STORAGE_PROVIDER === 'cloudinary') {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGE_FILES, fileSize: MAX_TOTAL_BYTES },
  fileFilter: (_req, file, done) => {
    if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      done(null, true);
      return;
    }
    done(ApiError.badRequest('Only JPEG, PNG and WebP images are accepted'));
  },
});

export async function storeImage(file: Express.Multer.File, folder: string): Promise<StoredImage> {
  return env.STORAGE_PROVIDER === 'cloudinary' ? storeWithCloudinary(file, folder) : storeOnDisk(file, folder);
}

export async function deleteImage(publicId: string, folder: string): Promise<void> {
  if (!publicId.startsWith(`${ownedPrefix(folder)}/`)) {
    throw ApiError.forbidden('That image does not belong to this listing');
  }

  if (env.STORAGE_PROVIDER === 'cloudinary') {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not_found') {
      throw new Error(`Cloudinary refused to delete the image (${result.result})`);
    }
    return;
  }

  // The key carries its own extension, so this can never miss the file and leave it behind.
  await unlink(resolve(LOCAL_UPLOAD_ROOT, publicId)).catch(() => undefined);
}

async function storeWithCloudinary(file: Express.Multer.File, folder: string): Promise<StoredImage> {
  // The master copy is downscaled and compressed on the way in, and the delivery URL asks
  // Cloudinary for the smallest format this browser understands.
  const uploaded = await new Promise<{ public_id: string; bytes: number; format: string }>((done, fail) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${CLOUDINARY_ROOT}/${folder}`,
        resource_type: 'image',
        overwrite: false,
        transformation: [
          { width: 1600, height: 1600, crop: 'limit' },
          { quality: 'auto:good' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          fail(error ?? new Error('Cloudinary returned no result'));
          return;
        }
        done({ public_id: result.public_id, bytes: result.bytes, format: result.format });
      }
    );
    stream.end(file.buffer);
  });

  return {
    url: cloudinary.url(uploaded.public_id, { secure: true, fetch_format: 'auto', quality: 'auto' }),
    publicId: uploaded.public_id,
    bytes: uploaded.bytes,
    format: uploaded.format,
  };
}

async function storeOnDisk(file: Express.Multer.File, folder: string): Promise<StoredImage> {
  const name = `${randomUUID()}.${EXTENSION_BY_TYPE[file.mimetype] ?? 'bin'}`;
  const publicId = `${ownedPrefix(folder)}/${name}`;

  await mkdir(resolve(LOCAL_UPLOAD_ROOT, folder), { recursive: true });
  await writeFile(join(LOCAL_UPLOAD_ROOT, publicId), file.buffer);

  return {
    url: `${env.PUBLIC_API_URL}/uploads/${publicId}`,
    publicId,
    bytes: file.size,
    format: file.mimetype,
  };
}
