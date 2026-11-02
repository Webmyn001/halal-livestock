export type UserRole = 'buyer' | 'farmer' | 'admin';

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

export interface Session {
  user: User;
  token: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: Extract<UserRole, 'buyer' | 'farmer'>;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export const COMPLAINT_CATEGORIES = [
  'listing_quality',
  'payment',
  'delivery',
  'account',
  'farmer_conduct',
  'other',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export type ComplaintStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export interface Complaint {
  id: string;
  category: ComplaintCategory;
  message: string;
  orderReference?: string;
  status: ComplaintStatus;
  adminResponse?: string;
  createdAt: string;
  handledAt?: string;
}

export interface ComplaintPayload {
  category: ComplaintCategory;
  message: string;
  orderReference?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
}

export const LISTING_SPECIES = ['rabbit', 'poultry', 'sheep', 'goat'] as const;
export type ListingSpecies = (typeof LISTING_SPECIES)[number];

export const LISTING_TYPES = ['live', 'halal_processed'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_UNITS = ['bird', 'head', 'crate', 'kg'] as const;
export type ListingUnit = (typeof LISTING_UNITS)[number];

export type ListingStatus = 'active' | 'sold' | 'removed';

export interface ListingImage {
  url: string;
  bytes: number;
  format: string;
  /** Only present on the farmer's own listings, because a delete request is built from it. */
  publicId?: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  species: ListingSpecies;
  breed?: string;
  listingType: ListingType;
  quantity: number;
  unit: ListingUnit;
  /** Kobo. Divide by 100 for the naira price. */
  priceKobo: number;
  town: string;
  state: string;
  status: ListingStatus;
  soldAt?: string | null;
  createdAt: string;
  images: ListingImage[];
  farmer: { id: string; fullName: string; isVerified: boolean } | null;
}

export interface ListingPage {
  listings: Listing[];
  page: number;
  pages: number;
  total: number;
}

export type ListingSort = 'newest' | 'price_low' | 'price_high';

export interface ListingFilters {
  species?: ListingSpecies;
  type?: ListingType;
  q?: string;
  sort?: ListingSort;
  page?: number;
}

export interface NewListingPayload {
  title: string;
  description: string;
  species: ListingSpecies;
  listingType: ListingType;
  breed?: string;
  quantity: number;
  unit: ListingUnit;
  priceNaira: number;
  town: string;
}

export interface ListingPatch {
  title?: string;
  description?: string;
  species?: ListingSpecies;
  listingType?: ListingType;
  breed?: string;
  quantity?: number;
  unit?: ListingUnit;
  priceNaira?: number;
  town?: string;
  status?: ListingStatus;
}
