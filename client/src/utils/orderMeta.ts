import type { DisputeReason, DisputeStatus, KycStatus, OrderStatus, SettlementStatus } from '../types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  funded: 'Payment received',
  preparing: 'Farmer is preparing',
  out_for_delivery: 'On the way to you',
  confirmed: 'Handed over',
  completed: 'Farmer has been paid',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-900 ring-amber-200',
  funded: 'bg-sky-100 text-sky-900 ring-sky-200',
  preparing: 'bg-violet-100 text-violet-900 ring-violet-200',
  out_for_delivery: 'bg-brand-100 text-brand-900 ring-brand-200',
  confirmed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  completed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  cancelled: 'bg-stone-100 text-stone-700 ring-stone-200',
  refunded: 'bg-rose-100 text-rose-900 ring-rose-200',
};

export function orderStatusStyle(status: OrderStatus): string {
  return ORDER_STATUS_STYLES[status];
}

/** The steps a buyer sees, in the order they happen. */
export const ORDER_STEPS: { status: OrderStatus; label: string; caption: string }[] = [
  { status: 'funded', label: 'Payment received', caption: 'Your money is held by the platform, not sent to the farm.' },
  { status: 'preparing', label: 'Farmer accepted', caption: 'The farm has taken the order and is getting the animals ready.' },
  { status: 'out_for_delivery', label: 'On the way', caption: 'A driver is bringing them to you with a code to collect.' },
  { status: 'confirmed', label: 'Handed over', caption: 'You checked the animals and gave the driver the code.' },
  { status: 'completed', label: 'Farmer paid', caption: 'The payout left the platform for the farm.' },
];

export function stepIndex(status: OrderStatus): number {
  const order: OrderStatus[] = ['awaiting_payment', 'funded', 'preparing', 'out_for_delivery', 'confirmed', 'completed'];
  const index = order.indexOf(status);
  return index < 0 ? -1 : index - 1;
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  animal_injured: 'An animal arrived hurt',
  wrong_quantity: 'The number was wrong',
  not_delivered: 'Nothing arrived',
  not_as_described: 'It was not what the listing showed',
  halal_concern: 'A halal concern',
  other: 'Something else',
};

const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  in_review: 'Being reviewed',
  refund_agreed: 'Refund agreed',
  release_agreed: 'Released to the farmer',
  rejected: 'Closed without change',
};

export function disputeStatusLabel(status: DisputeStatus): string {
  return DISPUTE_STATUS_LABELS[status];
}

const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: 'Ready to pay',
  held: 'Held back',
  released: 'Paid out',
};

export function settlementStatusLabel(status: SettlementStatus): string {
  return SETTLEMENT_STATUS_LABELS[status];
}

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  none: 'Not started',
  submitted: 'With the review team',
  approved: 'Verified farm',
  rejected: 'Needs a fix',
};

export const ID_TYPE_LABELS: Record<string, string> = {
  nin: 'National ID (NIN)',
  passport: 'International passport',
  drivers_license: "Driver's licence",
  vusv: 'VUSV slip',
};

export const BANK_OPTIONS = [
  'Access Bank',
  'First Bank',
  'GTBank',
  'KBIC',
  'Fidelity Bank',
  'Stanbic IBTC',
  'Union Bank',
  'Sterling Bank',
  'Opay',
  'Palmstrings',
];
