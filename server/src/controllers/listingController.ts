import type { Request, Response } from 'express';
import type { SortOrder } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import {
  Listing,
  toPublicListing,
  type IListingImage,
  type ListingDoc,
} from '../models/Listing';
import {
  deleteImage,
  listingFolder,
  MAX_IMAGE_FILES,
  MAX_TOTAL_BYTES,
  storeImage,
} from '../services/imageStore';
import {
  createListingSchema,
  listQuerySchema,
  removePhotoSchema,
  updateListingSchema,
  type CreateListingInput,
  type UpdateListingInput,
} from '../validation/listingSchemas';

const MEGABYTE = 1024 * 1024;
const FARMER_FIELDS = 'fullName farmerProfile.status';

const SORTS: Record<'newest' | 'price_low' | 'price_high', Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_low: { priceKobo: 1, createdAt: -1 },
  price_high: { priceKobo: -1, createdAt: -1 },
};

function asFiles(value: unknown): Express.Multer.File[] {
  if (Array.isArray(value)) return value as Express.Multer.File[];
  return value ? [value as Express.Multer.File] : [];
}

/** User text becomes a regex, so anything with a special meaning has to lose it first. */
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertBatch(files: Express.Multer.File[]): void {
  if (files.length === 0) throw ApiError.badRequest('Add at least one photo of the animal');
  if (files.length > MAX_IMAGE_FILES) {
    throw ApiError.badRequest(`Select no more than ${MAX_IMAGE_FILES} photos at a time`);
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw ApiError.badRequest(
      `That selection is ${(total / MEGABYTE).toFixed(1)} MB. Keep the whole set under ${MAX_TOTAL_BYTES / MEGABYTE} MB.`
    );
  }
}

/** `farmerId` is a raw id before populate and a document after, so both shapes have to give the id. */
function ownerIdOf(listing: ListingDoc): string {
  const ref = listing.farmerId as unknown as { id?: unknown } | string;
  // A populated document carries a string id; a bare ObjectId only has its hex form.
  return typeof ref === 'object' && ref !== null && typeof ref.id === 'string'
    ? ref.id
    : String(ref ?? '');
}

async function findOwnedListing(req: Request): Promise<ListingDoc> {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound('That listing no longer exists');
  if (ownerIdOf(listing) !== req.user!.userId) {
    throw ApiError.forbidden('You can only change your own listings');
  }
  return listing;
}

async function storeAll(files: Express.Multer.File[], folder: string): Promise<IListingImage[]> {
  const stored: IListingImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(file, folder));
  } catch (err) {
    // A half stored set would leave pictures that no listing points at.
    await Promise.allSettled(stored.map((image) => deleteImage(image.publicId, folder)));
    logger.error('Image storage rejected the upload', err instanceof Error ? err.message : err);
    throw new ApiError(502, 'UPLOAD_FAILED', 'The image service refused that upload. Try again in a moment.');
  }
  return stored;
}

export async function createListing(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateListingInput;
  const files = asFiles(req.files);
  assertBatch(files);

  const folder = listingFolder(req.user!.userId);
  const images = await storeAll(files, folder);

  const listing = await Listing.create({
    farmerId: req.user!.userId,
    title: input.title,
    description: input.description,
    species: input.species,
    breed: input.breed,
    listingType: input.listingType,
    quantity: input.quantity,
    unit: input.unit,
    priceKobo: Math.round(input.priceNaira * 100),
    town: input.town,
    state: input.state,
    images,
  });

  await listing.populate('farmerId', FARMER_FIELDS);
  sendSuccess(res, { listing: toPublicListing(listing, req.user!.userId) }, 201);
}

export async function listListings(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);

  const filter: Record<string, unknown> = { status: { $in: ['active', 'under_process', 'sold'] } };
  if (query.species) filter.species = query.species;
  if (query.type) filter.listingType = query.type;
  if (query.q) {
    const pattern = new RegExp(escapeForRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { breed: pattern }, { town: pattern }, { description: pattern }];
  }

  const sort = SORTS[query.sort];

  const [total, listings] = await Promise.all([
    Listing.countDocuments(filter),
    Listing.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('farmerId', FARMER_FIELDS),
  ]);

  sendSuccess(res, {
    listings: listings.map((listing) => toPublicListing(listing)),
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    total,
  });
}

export async function listMyListings(req: Request, res: Response): Promise<void> {
  const listings = await Listing.find({ farmerId: req.user!.userId })
    .sort({ createdAt: -1 })
    .populate('farmerId', FARMER_FIELDS);

  sendSuccess(res, {
    listings: listings.map((listing) => toPublicListing(listing, req.user!.userId)),
  });
}

export async function getListing(req: Request, res: Response): Promise<void> {
  const listing = await Listing.findById(req.params.id).populate('farmerId', FARMER_FIELDS);
  if (!listing) throw ApiError.notFound('That listing no longer exists');

  // A listing that has been taken down stays visible to the farmer who posted it.
  if (listing.status === 'removed' && ownerIdOf(listing) !== req.user?.userId) {
    throw ApiError.notFound('That listing no longer exists');
  }

  sendSuccess(res, { listing: toPublicListing(listing, req.user?.userId) });
}

export async function updateListing(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateListingInput;
  const listing = await findOwnedListing(req);

  if (input.title !== undefined) listing.title = input.title;
  if (input.description !== undefined) listing.description = input.description;
  if (input.species !== undefined) listing.species = input.species;
  if (input.listingType !== undefined) listing.listingType = input.listingType;
  if (input.breed !== undefined) listing.breed = input.breed;
  if (input.quantity !== undefined) listing.quantity = input.quantity;
  if (input.unit !== undefined) listing.unit = input.unit;
  if (input.priceNaira !== undefined) listing.priceKobo = Math.round(input.priceNaira * 100);
  if (input.town !== undefined) listing.town = input.town;
  if (input.state !== undefined) listing.state = input.state;

  if (input.status !== undefined && input.status !== listing.status) {
    listing.status = input.status;
    listing.soldAt = input.status === 'sold' ? new Date() : undefined;
  }

  await listing.save();
  await listing.populate('farmerId', FARMER_FIELDS);
  sendSuccess(res, { listing: toPublicListing(listing, req.user!.userId) });
}

export async function addListingPhotos(req: Request, res: Response): Promise<void> {
  const listing = await findOwnedListing(req);
  const files = asFiles(req.files);
  assertBatch(files);

  const room = MAX_IMAGE_FILES - listing.images.length;
  if (room <= 0) {
    throw ApiError.badRequest(`This listing already has ${MAX_IMAGE_FILES} photos. Remove one before adding another.`);
  }
  if (files.length > room) {
    throw ApiError.badRequest(`You can add ${room} more ${room === 1 ? 'photo' : 'photos'}. Remove one first.`);
  }

  const stored = await storeAll(files, listingFolder(req.user!.userId));
  listing.images.push(...stored);
  await listing.save();
  await listing.populate('farmerId', FARMER_FIELDS);

  sendSuccess(res, { listing: toPublicListing(listing, req.user!.userId) }, 201);
}

export async function removeListingPhoto(req: Request, res: Response): Promise<void> {
  const { publicId } = removePhotoSchema.parse(req.body);
  const listing = await findOwnedListing(req);

  if (!listing.images.some((image) => image.publicId === publicId)) {
    throw ApiError.notFound('That photo is not on this listing');
  }
  if (listing.images.length === 1) {
    throw ApiError.badRequest('A listing needs at least one photo. Add another one before removing this.');
  }

  await deleteImage(publicId, listingFolder(req.user!.userId));
  listing.images = listing.images.filter((image) => image.publicId !== publicId);
  await listing.save();
  await listing.populate('farmerId', FARMER_FIELDS);

  sendSuccess(res, { listing: toPublicListing(listing, req.user!.userId) });
}
