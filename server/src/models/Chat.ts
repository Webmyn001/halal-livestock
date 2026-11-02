import { Schema, model, type HydratedDocument, type PopulatedDoc } from 'mongoose';
import { refId } from '../utils/refId';
import type { OrderDoc } from './Order';
import type { UserDoc } from './User';

export interface IConversation {
  orderId: PopulatedDoc<OrderDoc>;
  buyerId: PopulatedDoc<UserDoc>;
  farmerId: PopulatedDoc<UserDoc>;
  lastMessageAt: Date;
  lastMessageBody: string;
  buyerUnread: number;
  farmerUnread: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDoc = HydratedDocument<IConversation>;

const conversationSchema = new Schema<IConversation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessageAt: { type: Date, default: () => new Date() },
    lastMessageBody: { type: String, default: '', maxlength: 200 },
    buyerUnread: { type: Number, default: 0, min: 0 },
    farmerUnread: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export interface IMessage {
  conversationId: PopulatedDoc<ConversationDoc>;
  senderId: PopulatedDoc<UserDoc>;
  senderRole: 'buyer' | 'farmer';
  body: string;
  createdAt: Date;
}

export type MessageDoc = HydratedDocument<IMessage>;

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['buyer', 'farmer'], required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export function toPublicMessage(message: MessageDoc) {
  const sender = message.senderId as unknown as { fullName?: string } | null;
  return {
    id: message.id,
    body: message.body,
    senderRole: message.senderRole,
    senderName: sender?.fullName,
    createdAt: message.createdAt,
  };
}

export function toPublicConversation(conversation: ConversationDoc, viewerRole: 'buyer' | 'farmer') {
  const order = conversation.orderId as unknown as { orderCode?: string } | null;
  return {
    id: conversation.id,
    orderId: refId(conversation.orderId),
    orderCode: order?.orderCode,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageBody: conversation.lastMessageBody,
    unread: viewerRole === 'buyer' ? conversation.buyerUnread : conversation.farmerUnread,
  };
}

export const Conversation = model<IConversation>('Conversation', conversationSchema);
export const Message = model<IMessage>('Message', messageSchema);
