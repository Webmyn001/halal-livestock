import { Schema, model, type HydratedDocument } from 'mongoose';

export interface IPushSubscription {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PushSubscriptionDoc = HydratedDocument<IPushSubscription>;

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    expirationTime: { type: Number },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

export const PushSubscription = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);