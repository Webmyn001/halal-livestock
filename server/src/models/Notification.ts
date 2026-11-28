import { Schema, model, type HydratedDocument } from 'mongoose';

export type NotificationTone = 'info' | 'success' | 'warning';
export type NotificationRole = 'buyer' | 'farmer' | 'admin' | 'all';
export type NotificationKind = 'order' | 'support' | 'system';

export interface INotification {
  userId?: string;
  recipientRole?: NotificationRole;
  kind: NotificationKind;
  senderName?: string;
  title: string;
  message: string;
  tone: NotificationTone;
  link?: string;
  isRead: boolean;
  readBy: string[];
  dismissedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, index: true },
    recipientRole: { type: String, enum: ['buyer', 'farmer', 'admin', 'all'], index: true },
    kind: { type: String, enum: ['order', 'support', 'system'], default: 'system', index: true },
    senderName: { type: String, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    tone: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readBy: { type: [String], default: [] },
    dismissedBy: { type: [String], default: [] },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);

export function toPublicNotification(doc: NotificationDoc, currentUserId?: string) {
  const isRead = doc.userId
    ? doc.isRead
    : currentUserId
      ? doc.readBy.includes(currentUserId)
      : doc.isRead;

  return {
    id: String(doc._id),
    kind: doc.kind ?? 'system',
    senderName: doc.senderName,
    title: doc.title,
    message: doc.message,
    tone: doc.tone,
    link: doc.link,
    isRead,
    createdAt: doc.createdAt.toISOString(),
  };
}
