import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { removeImage, uploadImages } from '../controllers/uploadController';
import { verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { imageUpload, MAX_IMAGE_FILES } from '../services/imageStore';
import { removeImageSchema } from '../validation/uploadSchemas';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many uploads. Try again in a few minutes.',
      details: { retryAfterMinutes: 15 },
    },
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  '/images',
  verifyToken,
  uploadLimiter,
  imageUpload.array('images', MAX_IMAGE_FILES),
  uploadImages
);
uploadRouter.delete('/images', verifyToken, uploadLimiter, validateBody(removeImageSchema), removeImage);
