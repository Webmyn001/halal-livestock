export type UserRole = 'buyer' | 'farmer' | 'admin';

export interface StoredPhoto {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  photos: StoredPhoto[];
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
