import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { Conversation, Message, toPublicConversation, toPublicMessage, type ConversationDoc } from '../models/Chat';
import { Order } from '../models/Order';
import { sendMessageSchema, threadListQuerySchema, type SendMessageInput } from '../validation/chatSchemas';

/** A thread belongs to the buyer and the farmer on one order, and to nobody else. */
async function findMyConversation(
  req: Request
): Promise<{ conversation: ConversationDoc; role: 'buyer' | 'farmer' }> {
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

  const order = await Order.findById(conversation.orderId).select('orderCode status');

  sendSuccess(res, {
    thread: toPublicConversation(conversation, role),
    order: order ? { id: order.id, orderCode: order.orderCode, status: order.status } : null,
    // Newest first is cheaper to page through, and the chat view reverses it.
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

  sendSuccess(res, { message: toPublicMessage(message) }, 201);
}
