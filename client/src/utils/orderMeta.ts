import type { DisputeReason, DisputeStatus, KycStatus, Order, OrderStatus, SettlementStatus } from '../types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  funded: 'Payment received',
  preparing: 'Farmer preparing',
  out_for_delivery: 'Livestock in transit',
  awaiting_buyer_confirmation: 'Awaiting your confirmation',
  delivery_overdue: 'Delivery overdue',
  confirmed: 'Delivery confirmed',
  awaiting_farmer_payout: 'Awaiting farmer payout',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Disputed',
};

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-900 ring-amber-200',
  funded: 'bg-sky-100 text-sky-900 ring-sky-200',
  preparing: 'bg-violet-100 text-violet-900 ring-violet-200',
  out_for_delivery: 'bg-brand-100 text-brand-900 ring-brand-200',
  awaiting_buyer_confirmation: 'bg-amber-100 text-amber-900 ring-amber-200',
  delivery_overdue: 'bg-rose-100 text-rose-900 ring-rose-200',
  confirmed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  awaiting_farmer_payout: 'bg-teal-100 text-teal-900 ring-teal-200',
  completed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  cancelled: 'bg-stone-100 text-stone-700 ring-stone-200',
  refunded: 'bg-rose-100 text-rose-900 ring-rose-200',
  disputed: 'bg-red-100 text-red-900 ring-red-200',
};

export function orderStatusStyle(status: OrderStatus): string {
  return ORDER_STATUS_STYLES[status];
}

export type TimelineStep = {
  key: string;
  label: string;
  caption: string;
  at?: string | null;
  state: 'done' | 'current' | 'upcoming';
};

function fmtEta(order: Order): string {
  if (order.expectedDeliveryAt) {
    const d = new Date(order.expectedDeliveryAt);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  if (order.deliveryEtaValue && order.deliveryEtaUnit) return `${order.deliveryEtaValue} ${order.deliveryEtaUnit}`;
  return 'Not provided';
}

export function getBuyerTimeline(order: Order): TimelineStep[] {
  const paymentDone = Boolean(order.paidAt) || !['awaiting_payment'].includes(order.status);
  const preparingStarted = Boolean(order.acceptedAt) || ['preparing', 'out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed', 'disputed'].includes(order.status);
  const dispatched = Boolean(order.dispatchedAt) || ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed', 'disputed'].includes(order.status);
  const confirmed = Boolean(order.confirmedAt) || ['confirmed', 'awaiting_farmer_payout', 'completed'].includes(order.status);
  const isCancelled = ['cancelled', 'refunded'].includes(order.status);

  const currentKey = isCancelled
    ? 'cancelled'
    : confirmed
      ? 'confirmed'
      : dispatched
        ? 'awaiting_confirmation'
        : preparingStarted
          ? 'preparing'
          : paymentDone
            ? 'payment'
            : 'payment_pending';

  const steps: TimelineStep[] = [
    {
      key: 'payment',
      label: 'Payment Successful',
      caption: 'Your payment has been received successfully. Your order is now awaiting preparation by the farmer.',
      at: order.paidAt,
      state: paymentDone ? (currentKey === 'payment' ? 'current' : 'done') : 'upcoming',
    },
    {
      key: 'preparing',
      label: 'Farmer Preparing Your Livestock',
      caption: preparingStarted
        ? 'The farmer has received your order and started preparing your livestock for delivery.'
        : 'The farmer will start preparing your livestock after accepting your paid order.',
      at: order.acceptedAt,
      state: preparingStarted ? (currentKey === 'preparing' ? 'current' : 'done') : paymentDone ? 'upcoming' : 'upcoming',
    },
    {
      key: 'transit',
      label: 'Your Livestock Is On Its Way',
      caption: dispatched
        ? `Expected delivery: ${fmtEta(order)}. Delivery fee, if any, is agreed directly with the farmer outside HalalLivestock.`
        : 'Once dispatched, you will see the expected delivery time here.',
      at: order.dispatchedAt,
      state: dispatched ? (currentKey === 'awaiting_confirmation' ? 'done' : 'done') : 'upcoming',
    },
    {
      key: 'awaiting_confirmation',
      label: 'Awaiting Your Confirmation',
      caption: dispatched
        ? 'Please confirm that your livestock has arrived and matches the agreed arrangement.'
        : 'After delivery, you can confirm receipt or report a problem here.',
      at: null,
      state: confirmed ? 'done' : dispatched ? 'current' : 'upcoming',
    },
    {
      key: 'confirmed',
      label: 'Delivery Confirmed',
      caption: 'Your livestock has been successfully delivered. Farmer payout is processed separately by admin.',
      at: order.confirmedAt,
      state: confirmed ? 'current' : 'upcoming',
    },
  ];

  // Mark earlier than current as done, later as upcoming
  const currentIdx = steps.findIndex((s) => s.state === 'current');
  if (currentIdx >= 0) {
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      if (!step) continue;
      if (i < currentIdx) step.state = 'done';
      if (i > currentIdx && step.state !== 'done') step.state = 'upcoming';
    }
  }
  return steps;
}

export function getFarmerTimeline(order: Order): TimelineStep[] {
  const paymentDone = Boolean(order.paidAt) || order.status !== 'awaiting_payment';
  const preparingStarted = Boolean(order.acceptedAt) || ['preparing', 'out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed', 'disputed'].includes(order.status);
  const dispatched = Boolean(order.dispatchedAt) || ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed', 'disputed'].includes(order.status);
  const confirmed = Boolean(order.confirmedAt) || ['confirmed', 'awaiting_farmer_payout', 'completed'].includes(order.status);
  const paid = order.payoutStatus === 'paid' || order.status === 'completed';
  const currentKey = paid ? 'paid' : confirmed ? 'awaiting_payout' : dispatched ? 'awaiting_confirmation' : preparingStarted ? 'dispatch' : paymentDone ? 'prepare' : 'waiting_payment';

  const steps: TimelineStep[] = [
    { key: 'waiting_payment', label: 'Payment received', caption: 'Buyer payment is held by HalalLivestock. Start preparation when ready.', at: order.paidAt, state: paymentDone ? 'done' : 'current' },
    { key: 'prepare', label: 'Start preparation', caption: 'Prepare the livestock and agree delivery details with the buyer in chat.', at: order.acceptedAt, state: preparingStarted ? 'done' : paymentDone ? 'current' : 'upcoming' },
    { key: 'dispatch', label: 'Dispatch livestock', caption: 'Dispatch and provide expected delivery time. Delivery fee is agreed outside the platform.', at: order.dispatchedAt, state: dispatched ? 'done' : preparingStarted ? 'current' : 'upcoming' },
    { key: 'awaiting_confirmation', label: 'Awaiting buyer confirmation', caption: 'Buyer must confirm receipt or report a problem.', at: null, state: confirmed ? 'done' : dispatched ? 'current' : 'upcoming' },
    { key: 'awaiting_payout', label: 'Awaiting admin payout', caption: 'Delivery confirmed. Admin will review and process your payout.', at: order.confirmedAt, state: paid ? 'done' : confirmed ? 'current' : 'upcoming' },
    { key: 'paid', label: 'Payment received', caption: 'Your payout has been successfully processed.', at: order.status === 'completed' ? (order.timeline?.find((t) => t.type === 'payout_released')?.at ?? null) : null, state: paid ? 'current' : 'upcoming' },
  ];
  const idx = steps.findIndex((s) => s.key === currentKey);
  if (idx >= 0) for (let i = 0; i < steps.length; i += 1) { const s = steps[i]; if (s) s.state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming'; }
  return steps;
}

export function getAdminTimeline(order: Order): TimelineStep[] {
  return getBuyerTimeline(order).map((s) => ({ ...s, caption: s.caption }));
}

/** Backward-compat wrapper used by old components. */
export function getOrderSteps(role: 'buyer' | 'farmer' | 'admin'): { status: OrderStatus; label: string; caption: string }[] {
  const base: Record<'buyer' | 'farmer' | 'admin', { status: OrderStatus; label: string; caption: string }[]> = {
    buyer: [
      { status: 'funded', label: 'Payment Successful', caption: 'Your payment has been received.' },
      { status: 'preparing', label: 'Farmer Preparing', caption: 'The farmer is preparing your livestock.' },
      { status: 'out_for_delivery', label: 'Livestock In Transit', caption: 'Your livestock is on the way.' },
      { status: 'confirmed', label: 'Delivery Confirmed', caption: 'You confirmed receipt.' },
      { status: 'completed', label: 'Completed', caption: 'Order complete.' },
    ],
    farmer: [
      { status: 'funded', label: 'Payment received', caption: 'Start preparing the livestock.' },
      { status: 'preparing', label: 'Preparing', caption: 'Get livestock ready for delivery.' },
      { status: 'out_for_delivery', label: 'Dispatched', caption: 'Livestock is in transit.' },
      { status: 'confirmed', label: 'Buyer confirmed', caption: 'Awaiting admin payout.' },
      { status: 'completed', label: 'Paid', caption: 'Payout released.' },
    ],
    admin: [
      { status: 'funded', label: 'Payment held', caption: 'Funds secured.' },
      { status: 'preparing', label: 'Preparing', caption: 'Farmer preparing.' },
      { status: 'out_for_delivery', label: 'In transit', caption: 'Dispatched.' },
      { status: 'confirmed', label: 'Confirmed', caption: 'Awaiting payout.' },
      { status: 'completed', label: 'Completed', caption: 'Payout released.' },
    ],
  };
  return base[role];
}

export const ORDER_STEPS = getOrderSteps('buyer');

export function stepIndex(status: OrderStatus): number {
  const order: OrderStatus[] = ['awaiting_payment', 'funded', 'preparing', 'out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed'];
  const index = order.indexOf(status);
  return index < 0 ? -1 : index;
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  animal_injured: 'Livestock arrived hurt or in poor condition',
  wrong_quantity: 'Wrong quantity delivered',
  not_delivered: 'Livestock not received',
  not_as_described: 'Livestock differs from agreed description',
  halal_concern: 'Halal/handling concern',
  other: 'Other delivery-related problem',
};

const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  in_review: 'Being reviewed',
  refund_agreed: 'Refund agreed',
  release_agreed: 'Released to farmer',
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
  'Kuda Bank',
  'Fidelity Bank',
  'Stanbic IBTC',
  'Union Bank',
  'Sterling Bank',
  'Opay',
  'Palmpay',
];
