export type UserRole = 'buyer' | 'farmer' | 'driver' | 'admin';

export type KycStatus = 'none' | 'submitted' | 'approved' | 'rejected';

export type IdType = 'nin' | 'passport' | 'drivers_license' | 'vusv';

export interface FarmerProfile {
  farmName?: string;
  businessName?: string;
  address?: string;
  town?: string;
  state?: string;
  idType?: IdType;
  idNumber?: string;
  cacNumber?: string;
  bankName?: string;
  accountName?: string;
  /** Masked for the owner, full for staff. */
  accountNumber?: string;
  documentUrl?: string;
  status: KycStatus;
  reviewNote?: string;
  reviewedAt?: string;
}

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isKycApproved?: boolean;
  farmerProfile?: FarmerProfile | null;
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

export const ORDER_STATUSES = [
  'awaiting_payment',
  'funded',
  'preparing',
  'out_for_delivery',
  'confirmed',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderPaymentState = 'unpaid' | 'held' | 'refunded';

export interface OrderSnapshot {
  title: string;
  species: ListingSpecies;
  listingType: ListingType;
  unit: ListingUnit;
  priceKobo: number;
  coverImage: string;
  town: string;
  state: string;
}

export interface OrderParty {
  id: string;
  fullName: string;
  phoneNumber?: string;
}

export interface OrderDelivery {
  contactName: string;
  contactPhone: string;
  address: string;
  town: string;
  state: string;
  wantedDate?: string | null;
}

export interface Order {
  id: string;
  orderCode: string;
  listingId: string;
  snapshot: OrderSnapshot;
  quantity: number;
  totalKobo: number;
  note?: string;
  status: OrderStatus;
  paymentState: OrderPaymentState;
  paymentReference?: string;
  paidAt?: string | null;
  acceptedAt?: string | null;
  dispatchedAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  refundedAt?: string | null;
  disputeOpen: boolean;
  settlementId?: string;
  delivery: OrderDelivery | null;
  buyer: OrderParty | null;
  farmer: OrderParty | null;
  driver?: OrderParty | null;
  /** Only the buyer sees this, and only while the animals are on the way. */
  confirmationCode?: string;
  canEnterCode: boolean;
  isBuyer: boolean;
  isFarmer: boolean;
  isDriver: boolean;
  createdAt: string;
}

export interface OrderPage {
  orders: Order[];
  page: number;
  pages: number;
  total: number;
}

export interface NewOrderPayload {
  listingId: string;
  quantity: number;
  contactName: string;
  contactPhone: string;
  address: string;
  town: string;
  state: string;
  wantedDate?: string;
  note?: string;
}

export interface Checkout {
  provider: 'mock' | 'paystack';
  reference: string;
  authorizationUrl: string;
}

export const DISPUTE_REASONS = [
  'animal_injured',
  'wrong_quantity',
  'not_delivered',
  'not_as_described',
  'halal_concern',
  'other',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export type DisputeStatus = 'open' | 'in_review' | 'refund_agreed' | 'release_agreed' | 'rejected';

export interface Dispute {
  id: string;
  orderId: string;
  orderCode?: string;
  orderTotalKobo?: number;
  openedByRole: 'buyer' | 'farmer';
  openedByName?: string;
  reason: DisputeReason;
  description: string;
  images: ListingImage[];
  status: DisputeStatus;
  resolutionNote?: string;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderRole: 'buyer' | 'farmer';
  senderName?: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  orderId: string;
  orderCode?: string;
  role: 'buyer' | 'farmer';
}

export interface ThreadSummary {
  id: string;
  orderId: string;
  orderCode?: string;
  lastMessageAt: string;
  lastMessageBody: string;
  unread: number;
}

export type SettlementStatus = 'pending' | 'held' | 'released';

export interface Settlement {
  id: string;
  orderId: string;
  orderCode?: string;
  farmerId: string;
  farmerName?: string;
  grossKobo: number;
  commissionKobo: number;
  netKobo: number;
  status: SettlementStatus;
  bank?: { bankName: string; accountName: string; accountNumber: string };
  reference?: string;
  releasedAt?: string | null;
  note?: string;
  createdAt: string;
}

export interface PlatformInfo {
  paymentsOpen: boolean;
  commissionBps: number;
  disputeWindowDays: number;
  supportEmail: string;
  supportPhone: string;
  maintenanceNote?: string;
}

export interface AdminCounts {
  buyers: number;
  farmers: number;
  drivers: number;
  activeListings: number;
  orders: Record<string, number>;
  openComplaints: number;
  openDisputes: number;
  kycWaiting: number;
  payouts: { pendingKobo: number; heldKobo: number; releasedKobo: number };
}
