import { Schema, model, type HydratedDocument, type PopulatedDoc } from 'mongoose';
import { refId } from '../utils/refId';
import { LISTING_SPECIES, LISTING_TYPES, LISTING_UNITS, type ListingDoc, type ListingSpecies, type ListingType, type ListingUnit } from './Listing';
import type { UserDoc } from './User';
import type { SettlementDoc } from './Settlement';

export const ORDER_STATUSES = [
  'awaiting_payment',
  'funded',
  'preparing',
  'out_for_delivery',
  'awaiting_buyer_confirmation',
  'confirmed',
  'awaiting_farmer_payout',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'delivery_overdue',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Where the money stands, kept apart from the delivery state so a hold does not rewrite history. */
export const ORDER_PAYMENT_STATES = ['unpaid', 'held', 'refunded'] as const;
export type OrderPaymentState = (typeof ORDER_PAYMENT_STATES)[number];

export const PREPARATION_STATUSES = ['none', 'awaiting_preparation', 'preparing', 'ready_for_dispatch'] as const;
export type PreparationStatus = (typeof PREPARATION_STATUSES)[number];

export const DELIVERY_STATUSES = ['none', 'awaiting_dispatch', 'in_transit', 'delivery_overdue', 'delivered'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const BUYER_CONFIRMATION_STATUSES = ['not_required', 'pending', 'confirmed', 'disputed'] as const;
export type BuyerConfirmationStatus = (typeof BUYER_CONFIRMATION_STATUSES)[number];

export const ORDER_PAYOUT_STATUSES = ['not_eligible', 'awaiting_payout', 'processing', 'paid', 'failed', 'held'] as const;
export type OrderPayoutStatus = (typeof ORDER_PAYOUT_STATUSES)[number];

export interface IOrderTimelineEvent {
  at: Date;
  actorId?: string;
  actorRole: 'buyer' | 'farmer' | 'admin' | 'driver' | 'system';
  type: string;
  label: string;
  note?: string;
}

export interface IOrderSnapshot {
  title: string;
  species: ListingSpecies;
  listingType: ListingType;
  unit: ListingUnit;
  priceKobo: number;
  coverImage: string;
  town: string;
  state: string;
}

export interface IOrder {
  /** Shown to buyers and quoted on the phone, so it never has to be re-derived. */
  orderCode: string;
  listingId: PopulatedDoc<ListingDoc>;
  farmerId: PopulatedDoc<UserDoc>;
  buyerId: PopulatedDoc<UserDoc>;
  /** The listing may be edited or taken down later, so the order keeps what was agreed. */
  snapshot: IOrderSnapshot;
  quantity: number;
  totalKobo: number;
  note?: string;
  contactName: string;
  contactPhone: string;
  address: string;
  town: string;
  state: string;
  wantedDate?: Date;
  status: OrderStatus;
  paymentState: OrderPaymentState;
  preparationStatus: PreparationStatus;
  deliveryStatus: DeliveryStatus;
  buyerConfirmationStatus: BuyerConfirmationStatus;
  payoutStatus: OrderPayoutStatus;
  paymentProvider?: string;
  paymentReference?: string;
  paidAt?: Date;
  acceptedAt?: Date;
  driverId?: PopulatedDoc<UserDoc>;
  /**
   * Handed to the buyer so they can speak it to the driver, which is why it is readable rather
   * than hashed. It is never selected by default and never sent to the driver.
   */
  confirmationCode?: string;
  confirmationCodeAttempts: number;
  dispatchedAt?: Date;
  deliveryEtaValue?: number;
  deliveryEtaUnit?: 'hours' | 'days';
  expectedDeliveryAt?: Date;
  deliveryNote?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  refundReference?: string;
  refundedAt?: Date;
  disputeOpen: boolean;
  settlementId?: PopulatedDoc<SettlementDoc>;
  timeline: IOrderTimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDoc = HydratedDocument<IOrder>;

const snapshotSchema = new Schema<IOrderSnapshot>(
  {
    title: { type: String, required: true },
    species: { type: String, enum: LISTING_SPECIES, required: true },
    listingType: { type: String, enum: LISTING_TYPES, required: true },
    unit: { type: String, enum: LISTING_UNITS, required: true },
    priceKobo: { type: Number, required: true },
    coverImage: { type: String, required: true },
    town: { type: String, required: true },
    state: { type: String, required: true },
  },
  { _id: false }
);

const timelineEventSchema = new Schema<IOrderTimelineEvent>(
  {
    at: { type: Date, required: true },
    actorId: { type: String },
    actorRole: { type: String, enum: ['buyer', 'farmer', 'admin', 'driver', 'system'], required: true },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    snapshot: { type: snapshotSchema, required: true },
    quantity: { type: Number, required: true, min: 1, max: 100_000 },
    totalKobo: { type: Number, required: true, min: 10_000, max: 10_000_000_000 },
    note: { type: String, trim: true, maxlength: 500 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactPhone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    town: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    wantedDate: Date,
    status: { type: String, enum: ORDER_STATUSES, default: 'awaiting_payment', index: true },
    paymentState: { type: String, enum: ORDER_PAYMENT_STATES, default: 'unpaid' },
    preparationStatus: { type: String, enum: PREPARATION_STATUSES, default: 'none' },
    deliveryStatus: { type: String, enum: DELIVERY_STATUSES, default: 'none' },
    buyerConfirmationStatus: { type: String, enum: BUYER_CONFIRMATION_STATUSES, default: 'not_required' },
    payoutStatus: { type: String, enum: ORDER_PAYOUT_STATUSES, default: 'not_eligible' },
    paymentProvider: String,
    paymentReference: String,
    paidAt: Date,
    acceptedAt: Date,
    driverId: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmationCode: { type: String, select: false },
    confirmationCodeAttempts: { type: Number, default: 0 },
    dispatchedAt: Date,
    deliveryEtaValue: { type: Number, min: 1, max: 720 },
    deliveryEtaUnit: { type: String, enum: ['hours', 'days'] },
    expectedDeliveryAt: Date,
    deliveryNote: { type: String, trim: true, maxlength: 500 },
    confirmedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },
    refundReference: String,
    refundedAt: Date,
    disputeOpen: { type: Boolean, default: false },
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement' },
    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ farmerId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export function deriveOrderLifecycle(order: Pick<IOrder, 'status' | 'paymentState' | 'disputeOpen' | 'settlementId' | 'preparationStatus' | 'deliveryStatus' | 'buyerConfirmationStatus' | 'payoutStatus'>) {
  const status = order.status;
  const preparationStatus: PreparationStatus =
    order.preparationStatus && order.preparationStatus !== 'none'
      ? order.preparationStatus
      : status === 'funded'
        ? 'awaiting_preparation'
        : status === 'preparing'
          ? 'preparing'
          : ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout', 'completed', 'disputed'].includes(status)
            ? 'ready_for_dispatch'
            : 'none';

  const deliveryStatus: DeliveryStatus =
    order.deliveryStatus && order.deliveryStatus !== 'none'
      ? order.deliveryStatus
      : status === 'out_for_delivery'
        ? 'in_transit'
        : status === 'awaiting_buyer_confirmation'
          ? 'in_transit'
          : status === 'delivery_overdue'
            ? 'delivery_overdue'
            : ['confirmed', 'awaiting_farmer_payout', 'completed'].includes(status)
              ? 'delivered'
              : ['funded', 'preparing'].includes(status)
                ? 'awaiting_dispatch'
                : 'none';

  const buyerConfirmationStatus: BuyerConfirmationStatus =
    order.buyerConfirmationStatus && order.buyerConfirmationStatus !== 'not_required'
      ? order.buyerConfirmationStatus
      : order.disputeOpen || status === 'disputed'
        ? 'disputed'
        : ['confirmed', 'awaiting_farmer_payout', 'completed'].includes(status)
          ? 'confirmed'
          : ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(status)
            ? 'pending'
            : 'not_required';

  const payoutStatus: OrderPayoutStatus =
    order.payoutStatus && order.payoutStatus !== 'not_eligible'
      ? order.payoutStatus
      : status === 'completed'
        ? 'paid'
        : status === 'awaiting_farmer_payout'
          ? 'awaiting_payout'
          : status === 'confirmed'
            ? 'awaiting_payout'
            : order.disputeOpen || status === 'disputed'
              ? 'held'
              : 'not_eligible';

  return { preparationStatus, deliveryStatus, buyerConfirmationStatus, payoutStatus };
}

/**
 * The handover code goes to the buyer, who has to read it out to the driver, and to staff. Anyone
 * else gets the order without it, and the driver gets a flag that says a code is waiting.
 */
export function toPublicOrder(order: OrderDoc, viewer: { userId: string; role: string }) {
  const buyer = order.buyerId as unknown as { fullName?: string; phoneNumber?: string } | null;
  const farmer = order.farmerId as unknown as { fullName?: string; phoneNumber?: string } | null;
  const driver = order.driverId as unknown as { fullName?: string; phoneNumber?: string } | null;

  const buyerId = refId(order.buyerId);
  const farmerId = refId(order.farmerId);
  const driverId = refId(order.driverId);

  const isBuyer = buyerId === viewer.userId;
  const isFarmer = farmerId === viewer.userId;
  const isDriver = Boolean(driverId) && driverId === viewer.userId;
  const isStaff = viewer.role === 'admin' || viewer.role === 'driver';
  const lifecycle = deriveOrderLifecycle(order);

  return {
    id: order.id,
    orderCode: order.orderCode,
    listingId: refId(order.listingId),
    snapshot: order.snapshot,
    quantity: order.quantity,
    totalKobo: order.totalKobo,
    note: order.note,
    status: order.status,
    paymentState: order.paymentState,
    preparationStatus: lifecycle.preparationStatus,
    deliveryStatus: lifecycle.deliveryStatus,
    buyerConfirmationStatus: lifecycle.buyerConfirmationStatus,
    payoutStatus: lifecycle.payoutStatus,
    paymentReference: isStaff || isBuyer ? order.paymentReference : undefined,
    paidAt: order.paidAt,
    acceptedAt: order.acceptedAt,
    dispatchedAt: order.dispatchedAt,
    deliveryEtaValue: order.deliveryEtaValue,
    deliveryEtaUnit: order.deliveryEtaUnit,
    expectedDeliveryAt: order.expectedDeliveryAt,
    deliveryNote: order.deliveryNote,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    refundedAt: order.refundedAt,
    disputeOpen: order.disputeOpen,
    settlementId: order.settlementId ? refId(order.settlementId) : undefined,
    timeline: (order.timeline ?? []).map((event) => ({
      at: event.at,
      actorRole: event.actorRole,
      type: event.type,
      label: event.label,
      note: event.note,
    })),
    /** Where the goods go. The farmer needs it to deliver, the buyer to check it, nobody else. */
    delivery: isBuyer || isFarmer || isStaff
      ? {
          contactName: order.contactName,
          contactPhone: order.contactPhone,
          address: order.address,
          town: order.town,
          state: order.state,
          wantedDate: order.wantedDate,
        }
      : null,
    buyer: isFarmer || isStaff || isBuyer ? (buyer?.fullName ? { id: buyerId, fullName: buyer.fullName, phoneNumber: buyer.phoneNumber } : null) : null,
    farmer: isBuyer || isStaff || isFarmer ? (farmer?.fullName ? { id: farmerId, fullName: farmer.fullName, phoneNumber: farmer.phoneNumber } : null) : null,
    driver: isStaff || isDriver || isBuyer || isFarmer
      ? driver?.fullName
        ? { id: driverId, fullName: driver.fullName, phoneNumber: driver.phoneNumber }
        : null
      : undefined,
    /** Live while the animals are on the way, then cleared so a used code cannot be replayed. */
    confirmationCode:
      (isBuyer || viewer.role === 'admin') && order.status === 'out_for_delivery'
        ? order.confirmationCode
        : undefined,
    canEnterCode: isDriver && order.status === 'out_for_delivery',
    isBuyer,
    isFarmer,
    isDriver,
    createdAt: order.createdAt,
  };
}

export const Order = model<IOrder>('Order', orderSchema);
