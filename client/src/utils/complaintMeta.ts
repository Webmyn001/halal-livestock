import type { ComplaintCategory, ComplaintStatus } from '../types';

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  listing_quality: 'A listing did not match what arrived',
  payment: 'Payment or refund',
  delivery: 'Delivery or the animals in transit',
  account: 'My account or sign in',
  farmer_conduct: 'How a farmer behaved',
  other: 'Something else',
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Open',
  under_review: 'Being reviewed',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_STYLES: Record<ComplaintStatus, string> = {
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
  under_review: 'bg-blue-50 text-blue-800 ring-blue-200',
  resolved: 'bg-brand-50 text-brand-800 ring-brand-200',
  closed: 'bg-stone-100 text-ink-700 ring-stone-300',
};
