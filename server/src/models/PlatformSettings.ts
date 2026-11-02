import { Schema, model, type HydratedDocument } from 'mongoose';

/** One document, keyed by this id, holds every tunable on the platform. */
export const SETTINGS_ID = 'default';

export interface IPlatformSettings {
  /** Always the SETTINGS_ID string, which is why it replaces the usual ObjectId. */
  _id: string;
  /** Share of the order value the platform keeps, in basis points. 500 is five percent. */
  commissionBps: number;
  /** Days a buyer has to raise a problem after handover before the payout is released. */
  disputeWindowDays: number;
  /** Where a buyer or farmer is told to send a written complaint. */
  supportEmail: string;
  supportPhone: string;
  /** Turned off only while the money path is being worked on, and it stops new checkouts. */
  paymentsOpen: boolean;
  maintenanceNote?: string;
  updatedAt: Date;
}

export type PlatformSettingsDoc = HydratedDocument<IPlatformSettings>;

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    _id: { type: String, default: SETTINGS_ID },
    commissionBps: { type: Number, required: true, min: 0, max: 5_000, default: 500 },
    disputeWindowDays: { type: Number, required: true, min: 0, max: 30, default: 7 },
    supportEmail: { type: String, required: true, lowercase: true, trim: true, default: 'support@halallivestocks.com' },
    supportPhone: { type: String, required: true, trim: true, default: '+2348000000000' },
    paymentsOpen: { type: Boolean, default: true },
    maintenanceNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

/**
 * Money is rounded down in the farmer's favour so a payout can never add up to more than the
 * buyer actually paid.
 */
export function splitCommission(totalKobo: number, commissionBps: number) {
  const commissionKobo = Math.floor((totalKobo * commissionBps) / 10_000);
  return { commissionKobo, netKobo: totalKobo - commissionKobo };
}

export function toPublicSettings(settings: IPlatformSettings) {
  return {
    commissionBps: settings.commissionBps,
    disputeWindowDays: settings.disputeWindowDays,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    paymentsOpen: settings.paymentsOpen,
    maintenanceNote: settings.maintenanceNote,
  };
}

/** Reads the single document, creating it on first use so a fresh cluster still works. */
export async function loadSettings(): Promise<PlatformSettingsDoc> {
  const existing = await PlatformSettings.findById(SETTINGS_ID);
  if (existing) return existing;
  try {
    return await PlatformSettings.create({ _id: SETTINGS_ID });
  } catch {
    // Two requests can race onto the same id on a cold start; the loser re-reads the winner.
    const winner = await PlatformSettings.findById(SETTINGS_ID);
    if (!winner) throw new Error('Platform settings could not be read');
    return winner;
  }
}

export const PlatformSettings = model<IPlatformSettings>('PlatformSettings', platformSettingsSchema);
