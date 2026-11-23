import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  addListingPhotos,
  createListing,
  deleteListing,
  getListing,
  listListings,
  listMyListings,
  removeListingPhoto,
  updateListing,
} from '../controllers/listingController';
import { requireRole, attachUserIfPresent, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { imageUpload, MAX_IMAGE_FILES } from '../services/imageStore';
import { createListingSchema, updateListingSchema } from '../validation/listingSchemas';

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many posts in a short time. Try again in a few minutes.',
      details: { retryAfterMinutes: 15 },
    },
  },
});

export const listingRouter = Router();

listingRouter.get('/', listListings);
listingRouter.get('/mine', requireRole('farmer'), listMyListings);
listingRouter.get('/:id', attachUserIfPresent, getListing);

listingRouter.post(
  '/',
  requireRole('farmer'),
  writeLimiter,
  imageUpload.array('images', MAX_IMAGE_FILES),
  validateBody(createListingSchema),
  createListing
);

listingRouter.patch('/:id', verifyToken, writeLimiter, validateBody(updateListingSchema), updateListing);
listingRouter.delete('/:id', verifyToken, writeLimiter, deleteListing);

listingRouter.post(
  '/:id/photos',
  requireRole('farmer'),
  writeLimiter,
  imageUpload.array('images', MAX_IMAGE_FILES),
  addListingPhotos
);
listingRouter.delete('/:id/photos', requireRole('farmer'), writeLimiter, removeListingPhoto);
