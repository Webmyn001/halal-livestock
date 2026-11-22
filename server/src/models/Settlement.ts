import { Schema, model, type HydratedDocument, type PopulatedDoc } from 'mongoose';
import { refId } from '../utils/refId';
import type { OrderDoc } from './Order';
import type { UserDoc } from './User';

export const SETTLEMENT_STATUSES = ['pending', 'held', 'released'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export interface ISettlementBank {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface ISettlement {
  orderId: PopulatedDoc<OrderDoc>;
  farmerId: PopulatedDoc<UserDoc>;
  /** What the buyer paid. */
  grossKobo: number;
  /** The platform share, taken from the settings in force on the day of handover. */
  commissionKobo: number;
  /** What the farmer is owed. grossKobo minus commissionKobo, always. */
  netKobo: number;
  status: SettlementStatus;
  /** Copied at release so a later edit to the farmer does not rewrite a paid payout. */
  bank?: ISettlementBank;
  reference?: string;
  releasedAt?: Date;
  releasedById?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SettlementDoc = HydratedDocument<ISettlement>;

const bankSchema = new Schema<ISettlementBank>(
  {
    bankName: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const settlementSchema = new Schema<ISettlement>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    grossKobo: { type: Number, required: true, min: 0 },
    commissionKobo: { type: Number, required: true, min: 0 },
    netKobo: { type: Number, required: true, min: 0 },
    status: { type: String, enum: SETTLEMENT_STATUSES, default: 'pending', index: true },
    bank: bankSchema,
    reference: { type: String, trim: true, maxlength: 60 },
    releasedAt: Date,
    releasedById: String,
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

settlementSchema.index({ createdAt: -1 });

export function toPublicSettlement(settlement: SettlementDoc) {
  const order = settlement.orderId as unknown as { orderCode?: string } | null;
  const farmer = settlement.farmerId as unknown as {
    fullName?: string;
    farmerProfile?: { bankName?: string; accountName?: string; accountNumber?: string };
  } | null;
  const profile = farmer?.farmerProfile;

  // Staff need the live KYC account before they send the money. `bank` is the snapshot taken at
  // release, so it is absent until then; `farmerBank` makes the pending row actionable.
  const farmerBank =
    profile?.bankName && profile.accountName && profile.accountNumber
      ? { bankName: profile.bankName, accountName: profile.accountName, accountNumber: profile.accountNumber }
      : undefined;

  return {
    id: settlement.id,
    orderId: refId(settlement.orderId),
    orderCode: order?.orderCode,
    farmerId: refId(settlement.farmerId),
    farmerName: farmer?.fullName,
    grossKobo: settlement.grossKobo,
    commissionKobo: settlement.commissionKobo,
    netKobo: settlement.netKobo,
    status: settlement.status,
    farmerBank,
    bank: settlement.bank,
    reference: settlement.reference,
    releasedAt: settlement.releasedAt,
    note: settlement.note,
    createdAt: settlement.createdAt,
  };
}

export const Settlement = model<ISettlement>('Settlement', settlementSchema);
