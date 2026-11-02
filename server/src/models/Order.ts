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
  'confirmed',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Where the money stands, kept apart from the delivery state so a hold does not rewrite history. */
export const ORDER_PAYMENT_STATES = ['unpaid', 'held', 'refunded'] as const;
export type OrderPaymentState = (typeof ORDER_PAYMENT_STATES)[number];

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
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  refundReference?: string;
  refundedAt?: Date;
  disputeOpen: boolean;
  settlementId?: PopulatedDoc<SettlementDoc>;
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
    paymentProvider: String,
    paymentReference: String,
    paidAt: Date,
    acceptedAt: Date,
    driverId: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmationCode: { type: String, select: false },
    confirmationCodeAttempts: { type: Number, default: 0 },
    dispatchedAt: Date,
    confirmedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },
    refundReference: String,
    refundedAt: Date,
    disputeOpen: { type: Boolean, default: false },
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement' },
  },
  { timestamps: true }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ farmerId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

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
    paymentReference: isStaff || isBuyer ? order.paymentReference : undefined,
    paidAt: order.paidAt,
    acceptedAt: order.acceptedAt,
    dispatchedAt: order.dispatchedAt,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    refundedAt: order.refundedAt,
    disputeOpen: order.disputeOpen,
    settlementId: order.settlementId ? refId(order.settlementId) : undefined,
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
