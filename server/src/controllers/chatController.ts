import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { Conversation, Message, toPublicConversation, toPublicMessage, type ConversationDoc } from '../models/Chat';
import { Listing } from '../models/Listing';
import { Order } from '../models/Order';
import { sendMessageSchema, threadListQuerySchema, type SendMessageInput } from '../validation/chatSchemas';
import { sendPushToUser } from '../services/pushService';

async function findMyConversation(req: Request): Promise<{ conversation: ConversationDoc; role: 'buyer' | 'farmer' }> {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound('That conversation does not exist');

  const userId = req.user!.userId;
  if (String(conversation.buyerId) === userId) return { conversation, role: 'buyer' };
  if (String(conversation.farmerId) === userId) return { conversation, role: 'farmer' };

  throw ApiError.forbidden('This conversation is not yours');
}

export async function listMyThreads(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const role = req.user!.role === 'farmer' ? 'farmer' : 'buyer';

  const conversations = await Conversation.find(role === 'farmer' ? { farmerId: userId } : { buyerId: userId })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate('orderId', 'orderCode');

  sendSuccess(res, { threads: conversations.map((conversation) => toPublicConversation(conversation, role)) });
}

export async function readThread(req: Request, res: Response): Promise<void> {
  const { conversation, role } = await findMyConversation(req);

  const query = threadListQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { conversationId: conversation._id };
  if (query.before) filter.createdAt = { $lt: query.before };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(query.limit, 100))
    .populate('senderId', 'fullName');

  if (role === 'buyer') conversation.buyerUnread = 0;
  else conversation.farmerUnread = 0;
  await conversation.save();

  const order = conversation.orderId ? await Order.findById(conversation.orderId).select('orderCode status').lean() : null;
  const listing = conversation.listingId ? await Listing.findById(conversation.listingId).select('title').lean() : null;

  sendSuccess(res, {
    thread: toPublicConversation(conversation, role),
    order: order ? { id: String(order._id), orderCode: order.orderCode, status: order.status } : null,
    listing: listing ? { id: String(listing._id), title: listing.title } : null,
    messages: messages.reverse().map(toPublicMessage),
  });
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  const { body } = sendMessageSchema.parse(req.body) as SendMessageInput;
  const { conversation, role } = await findMyConversation(req);

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user!.userId,
    senderRole: role,
    body,
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageBody = body.length > 180 ? `${body.slice(0, 180)}…` : body;
  if (role === 'buyer') conversation.farmerUnread += 1;
  else conversation.buyerUnread += 1;
  await conversation.save();

  const recipientId = role === 'buyer' ? String(conversation.farmerId) : String(conversation.buyerId);
  const url = conversation.kind === 'listing' && conversation.listingId
    ? `/marketplace/${String(conversation.listingId)}?thread=${String(conversation._id)}`
    : `/orders/${String(conversation.orderId)}`;
  void sendPushToUser(recipientId, {
    title: 'New message on Halal Livestocks',
    body: conversation.lastMessageBody,
    url,
    tag: `chat:${String(conversation._id)}`,
  }).catch(() => {});

  sendSuccess(res, { message: toPublicMessage(message) }, 201);
}

export async function getListingThread(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const role = req.user!.role;
  if (role !== 'buyer') throw ApiError.forbidden('Only buyers can start a listing chat');

  const listing = await Listing.findById(req.params.listingId).select('farmerId title status').lean();
  if (!listing) throw ApiError.notFound('That listing no longer exists');
  if (String(listing.farmerId) === userId) throw ApiError.badRequest('You cannot chat with yourself');

  let conversation: ConversationDoc | null = await Conversation.findOne({ listingId: listing._id, buyerId: userId } as any);
  if (!conversation) {
    conversation = await Conversation.create({
      kind: 'listing',
      listingId: listing._id,
      buyerId: userId,
      farmerId: listing.farmerId,
      lastMessageAt: new Date(),
      lastMessageBody: '',
    } as any);
  }

  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(200).populate('senderId', 'fullName');
  conversation.buyerUnread = 0;
  await conversation.save();

  sendSuccess(res, {
    conversation: { id: conversation.id, listingId: String(listing._id), kind: 'listing', role: 'buyer' },
    listing: { id: String(listing._id), title: listing.title },
    messages: messages.map(toPublicMessage),
  });
}
