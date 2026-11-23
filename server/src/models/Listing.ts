import { Schema, model, type HydratedDocument, type PopulatedDoc } from 'mongoose';
import { refId } from '../utils/refId';
import type { UserDoc } from './User';

export const LISTING_SPECIES = ['rabbit', 'poultry', 'sheep', 'goat'] as const;
export type ListingSpecies = (typeof LISTING_SPECIES)[number];

export const LISTING_TYPES = ['live', 'halal_processed'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_UNITS = ['bird', 'head', 'crate', 'kg'] as const;
export type ListingUnit = (typeof LISTING_UNITS)[number];

export const LISTING_STATUSES = ['active', 'under_process', 'sold', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface IListingImage {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

export interface IListing {
  farmerId: PopulatedDoc<UserDoc>;
  title: string;
  description: string;
  species: ListingSpecies;
  breed?: string;
  listingType: ListingType;
  quantity: number;
  unit: ListingUnit;
  /** Stored in kobo so no part of the money path ever holds a float. */
  priceKobo: number;
  town: string;
  state: string;
  images: IListingImage[];
  status: ListingStatus;
  soldAt?: Date;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ListingDoc = HydratedDocument<IListing>;

const imageSchema = new Schema<IListingImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    bytes: { type: Number, required: true },
    format: { type: String, required: true },
  },
  { _id: false }
);

const listingSchema = new Schema<IListing>(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 6, maxlength: 90 },
    description: { type: String, required: true, trim: true, minlength: 30, maxlength: 2000 },
    species: { type: String, enum: LISTING_SPECIES, required: true },
    breed: { type: String, trim: true, maxlength: 60 },
    listingType: { type: String, enum: LISTING_TYPES, required: true },
    quantity: { type: Number, required: true, min: 1, max: 100_000 },
    unit: { type: String, enum: LISTING_UNITS, required: true },
    priceKobo: { type: Number, required: true, min: 10_000, max: 1_000_000_000 },
    town: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60, default: 'Oyo State' },
    images: { type: [imageSchema], required: true, validate: [(v: IListingImage[]) => v.length > 0, 'A listing needs at least one photo'] },
    status: { type: String, enum: LISTING_STATUSES, default: 'active', index: true },
    soldAt: Date,
    views: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ species: 1, listingType: 1, status: 1 });

/**
 * The storage key is only handed to the farmer who owns the listing, because it is what a delete
 * request is made of. Everyone else sees the picture and nothing else.
 */
export function toPublicListing(listing: ListingDoc, viewerId?: string) {
  const farmer = listing.farmerId as unknown as { fullName?: string; farmerProfile?: { status?: string } } | null;
  const isOwner = viewerId !== undefined && refId(listing.farmerId) === viewerId;

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    species: listing.species,
    breed: listing.breed,
    listingType: listing.listingType,
    quantity: listing.quantity,
    unit: listing.unit,
    priceKobo: listing.priceKobo,
    town: listing.town,
    state: listing.state,
    status: listing.status,
    soldAt: listing.soldAt,
    views: listing.views ?? 0,
    createdAt: listing.createdAt,
    images: listing.images.map((image) => ({
      url: image.url,
      bytes: image.bytes,
      format: image.format,
      ...(isOwner ? { publicId: image.publicId } : {}),
    })),
    farmer: farmer
      ? {
          id: refId(listing.farmerId),
          fullName: farmer.fullName,
          isVerified: farmer.farmerProfile?.status === 'approved',
        }
      : null,
  };
}

export const Listing = model<IListing>('Listing', listingSchema);
