import { z } from 'zod';
import { LISTING_SPECIES, LISTING_STATUSES, LISTING_TYPES, LISTING_UNITS } from '../models/Listing';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * A listing arrives as multipart form data, so every number comes in as a string and has to be
 * coerced before it can be trusted.
 */
export const createListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(6, 'Give the listing a title of at least 6 characters')
    .max(90, 'Keep the title under 90 characters'),
  description: z
    .string()
    .trim()
    .min(30, 'Describe the animal in at least 30 characters so buyers know what they are seeing')
    .max(2000, 'Keep the description under 2000 characters'),
  species: z.enum(LISTING_SPECIES, 'Choose the type of animal'),
  listingType: z.enum(LISTING_TYPES, 'Choose live or halal processed'),
  breed: optionalText(60),
  quantity: z.coerce.number().int('Enter a whole number').min(1, 'At least one animal').max(100_000),
  unit: z.enum(LISTING_UNITS, 'Choose how the animal is counted'),
  priceNaira: z.coerce
    .number()
    .min(100, 'The lowest price is ₦100')
    .max(10_000_000, 'That price is too high to list here'),
  town: z.string().trim().min(2, 'Name the town or area').max(60),
  state: z.string().trim().min(2).max(60).default('Oyo State'),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(6).max(90).optional(),
  description: z.string().trim().min(30).max(2000).optional(),
  species: z.enum(LISTING_SPECIES).optional(),
  listingType: z.enum(LISTING_TYPES).optional(),
  breed: optionalText(60),
  quantity: z.coerce.number().int().min(1).max(100_000).optional(),
  unit: z.enum(LISTING_UNITS).optional(),
  priceNaira: z.coerce.number().min(100).max(10_000_000).optional(),
  town: z.string().trim().min(2).max(60).optional(),
  state: z.string().trim().min(2).max(60).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

export const listQuerySchema = z.object({
  species: z.enum(LISTING_SPECIES).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  q: optionalText(80),
  sort: z.enum(['newest', 'price_low', 'price_high']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export const removePhotoSchema = z.object({
  publicId: z.string().trim().min(4, 'Missing photo reference').max(300),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
