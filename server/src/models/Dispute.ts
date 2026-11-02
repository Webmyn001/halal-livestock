import { Schema, model, type HydratedDocument, type PopulatedDoc } from 'mongoose';
import { refId } from '../utils/refId';
import type { OrderDoc } from './Order';
import type { UserDoc } from './User';

export const DISPUTE_REASONS = [
  'animal_injured',
  'wrong_quantity',
  'not_delivered',
  'not_as_described',
  'halal_concern',
  'other',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_STATUSES = ['open', 'in_review', 'refund_agreed', 'release_agreed', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export interface IDisputeImage {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

export interface IDispute {
  orderId: PopulatedDoc<OrderDoc>;
  openedById: PopulatedDoc<UserDoc>;
  /** Buyer or farmer. Staff can open one on behalf of a caller but never as a party. */
  openedByRole: 'buyer' | 'farmer';
  reason: DisputeReason;
  description: string;
  images: IDisputeImage[];
  status: DisputeStatus;
  resolutionNote?: string;
  resolvedById?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type DisputeDoc = HydratedDocument<IDispute>;

const disputeImageSchema = new Schema<IDisputeImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    bytes: { type: Number, required: true },
    format: { type: String, required: true },
  },
  { _id: false }
);

const disputeSchema = new Schema<IDispute>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    openedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedByRole: { type: String, enum: ['buyer', 'farmer'], required: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    images: { type: [disputeImageSchema], default: [] },
    status: { type: String, enum: DISPUTE_STATUSES, default: 'open', index: true },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
    resolvedById: String,
    resolvedAt: Date,
  },
  { timestamps: true }
);

disputeSchema.index({ createdAt: -1 });

export function toPublicDispute(dispute: DisputeDoc, viewerId?: string) {
  const order = dispute.orderId as unknown as { orderCode?: string; totalKobo?: number } | null;
  const opener = dispute.openedById as unknown as { fullName?: string } | null;

  return {
    id: dispute.id,
    orderId: refId(dispute.orderId),
    orderCode: order?.orderCode,
    orderTotalKobo: order?.totalKobo,
    openedByRole: dispute.openedByRole,
    openedByName: opener?.fullName,
    /** The storage key lets the author take their own picture back down. */
    images: dispute.images.map((image) => ({
      url: image.url,
      bytes: image.bytes,
      format: image.format,
      ...(refId(dispute.openedById) === viewerId ? { publicId: image.publicId } : {}),
    })),
    reason: dispute.reason,
    description: dispute.description,
    status: dispute.status,
    resolutionNote: dispute.resolutionNote,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
  };
}

export const Dispute = model<IDispute>('Dispute', disputeSchema);
