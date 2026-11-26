import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { Dispute, toPublicDispute, type DisputeDoc, type IDisputeImage } from '../models/Dispute';
import { Notification } from '../models/Notification';
import { Order, type OrderDoc } from '../models/Order';
import { loadSettings } from '../models/PlatformSettings';
import { Settlement } from '../models/Settlement';
import { deleteImage, disputeFolder, MAX_IMAGE_FILES, MAX_TOTAL_BYTES, storeImage } from '../services/imageStore';
import { createDisputeSchema, type CreateDisputeInput } from '../validation/disputeSchemas';

const MAX_EVIDENCE_PHOTOS = 6;
const OPENABLE_STATUSES = ['funded', 'preparing', 'out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout'];

function asFiles(value: unknown): Express.Multer.File[] {
  if (Array.isArray(value)) return value as Express.Multer.File[];
  return value ? [value as Express.Multer.File] : [];
}

function assertBatch(files: Express.Multer.File[]): void {
  if (files.length === 0) throw ApiError.badRequest('Attach at least one photo');
  if (files.length > MAX_IMAGE_FILES) throw ApiError.badRequest(`Select no more than ${MAX_IMAGE_FILES} photos at a time`);

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw ApiError.badRequest(`That selection is ${(total / (1024 * 1024)).toFixed(1)} MB. Keep the whole set under ${MAX_TOTAL_BYTES / (1024 * 1024)} MB.`);
  }
}

async function storeAll(files: Express.Multer.File[], folder: string): Promise<IDisputeImage[]> {
  const stored: IDisputeImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(file, folder));
  } catch (err) {
    await Promise.allSettled(stored.map((image) => deleteImage(image.publicId, folder)));
    logger.error('Image storage rejected the evidence upload', err instanceof Error ? err.message : err);
    throw new ApiError(502, 'UPLOAD_FAILED', 'The image service refused that upload. Try again in a moment.');
  }
  return stored;
}

async function partyRole(order: OrderDoc, userId: string): Promise<'buyer' | 'farmer' | null> {
  if (String(order.buyerId) === userId) return 'buyer';
  if (String(order.farmerId) === userId) return 'farmer';
  return null;
}

export async function createDispute(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateDisputeInput;
  const files = asFiles(req.files);

  const order = await Order.findById(input.orderId);
  if (!order) throw ApiError.notFound('That order no longer exists');

  const role = await partyRole(order, req.user!.userId);
  if (!role) throw ApiError.forbidden('That order is not yours');
  if (order.disputeOpen) throw ApiError.conflict('There is already an open case on this order');
  if (!OPENABLE_STATUSES.includes(order.status)) {
    throw ApiError.conflict('A case can only be opened once the payment is held or the animals have arrived');
  }
  if (files.length === 0) throw ApiError.badRequest('Add a photo of what arrived. A case without evidence cannot be judged.');

  // The window is a promise made at handover, so it is counted from the moment the code was entered.
  const settings = await loadSettings();
  if (order.status === 'confirmed' && order.confirmedAt) {
    const deadline = order.confirmedAt.getTime() + settings.disputeWindowDays * 86_400_000;
    if (Date.now() > deadline) {
      throw ApiError.conflict(`The ${settings.disputeWindowDays} day window on this order has closed. Contact support.`);
    }
  }

  assertBatch(files);
  const images = await storeAll(files, disputeFolder(req.user!.userId));

  const dispute = await Dispute.create({
    orderId: order._id,
    openedById: req.user!.userId,
    openedByRole: role,
    reason: input.reason,
    description: input.description,
    images,
  });

  // The payout waits while a case is live, so a ruling is the only thing that moves money.
  order.disputeOpen = true;
  order.buyerConfirmationStatus = 'disputed';
  order.payoutStatus = 'held';
  order.status = 'disputed';
  order.timeline = order.timeline ?? [];
  order.timeline.push({
    at: new Date(),
    actorRole: role,
    actorId: req.user!.userId,
    type: 'dispute_opened',
    label: 'Dispute opened',
    note: input.description.slice(0, 200),
  });
  await order.save();

  const settlement = await Settlement.findOne({ orderId: order._id });
  if (settlement && settlement.status === 'pending') {
    settlement.status = 'held';
    settlement.note = 'Held while a dispute is open';
    await settlement.save();
  }

  const link = `/orders/${order.id}`;
  const title = `Dispute opened: ${order.orderCode}`;
  const buyerMsg = `Your dispute for ${order.orderCode} was submitted. Admin will review it.`;
  const farmerMsg = `A buyer reported a delivery problem for ${order.orderCode}. Payout is suspended until admin review.`;
  const adminMsg = `Buyer reported a delivery problem on ${order.orderCode}. Dispute opened - review and resolve it.`;
  await Promise.allSettled([
    Notification.create({ userId: String(order.buyerId), title, message: buyerMsg, tone: 'warning', link, isRead: false, readBy: [] }),
    Notification.create({ userId: String(order.farmerId), title, message: farmerMsg, tone: 'warning', link, isRead: false, readBy: [] }),
    Notification.create({ recipientRole: 'admin', title, message: adminMsg, tone: 'warning', link, isRead: false, readBy: [] }),
  ]);

  await dispute.populate('orderId', 'orderCode totalKobo');
  sendSuccess(res, { dispute: toPublicDispute(dispute, req.user!.userId) }, 201);
}

export async function listMyDisputes(req: Request, res: Response): Promise<void> {
  const orders = await Order.find({ $or: [{ buyerId: req.user!.userId }, { farmerId: req.user!.userId }] })
    .select('_id')
    .lean();

  const disputes = await Dispute.find({ orderId: { $in: orders.map((order) => order._id) } })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('orderId', 'orderCode totalKobo');

  sendSuccess(res, { disputes: disputes.map((dispute) => toPublicDispute(dispute, req.user!.userId)) });
}

async function findOwnDispute(req: Request): Promise<DisputeDoc> {
  const dispute = await Dispute.findById(req.params.id).populate('orderId', 'orderCode totalKobo');
  if (!dispute) throw ApiError.notFound('That case no longer exists');

  const viewer = req.user!;
  const order = dispute.orderId as unknown as { buyerId?: unknown; farmerId?: unknown } | null;
  const isParty =
    String(order?.buyerId ?? '') === viewer.userId || String(order?.farmerId ?? '') === viewer.userId || viewer.role === 'admin';

  if (!isParty) throw ApiError.forbidden('That case is not yours');
  return dispute;
}

export async function getDispute(req: Request, res: Response): Promise<void> {
  const dispute = await findOwnDispute(req);
  sendSuccess(res, { dispute: toPublicDispute(dispute, req.user!.userId) });
}

export async function addDisputeEvidence(req: Request, res: Response): Promise<void> {
  const dispute = await findOwnDispute(req);
  if (String(dispute.openedById) !== req.user!.userId) throw ApiError.forbidden('Only the person who opened the case can add to it');
  if (dispute.status !== 'open' && dispute.status !== 'in_review') throw ApiError.conflict('This case is closed');

  const files = asFiles(req.files);
  assertBatch(files);

  const room = MAX_EVIDENCE_PHOTOS - dispute.images.length;
  if (room <= 0) throw ApiError.badRequest(`This case already has ${MAX_EVIDENCE_PHOTOS} photos`);
  if (files.length > room) throw ApiError.badRequest(`You can add ${room} more ${room === 1 ? 'photo' : 'photos'}`);

  dispute.images.push(...(await storeAll(files, disputeFolder(req.user!.userId))));
  await dispute.save();
  sendSuccess(res, { dispute: toPublicDispute(dispute, req.user!.userId) }, 201);
}

export async function removeDisputeEvidence(req: Request, res: Response): Promise<void> {
  const { publicId } = req.body as { publicId?: string };
  if (!publicId) throw ApiError.badRequest('Say which photo to remove');

  const dispute = await findOwnDispute(req);
  if (String(dispute.openedById) !== req.user!.userId) throw ApiError.forbidden('Only the person who opened the case can remove its photos');

  const image = dispute.images.find((entry) => entry.publicId === publicId);
  if (!image) throw ApiError.notFound('That photo is not on this case');

  await deleteImage(publicId, disputeFolder(req.user!.userId));
  dispute.images = dispute.images.filter((entry) => entry.publicId !== publicId);
  await dispute.save();

  sendSuccess(res, { dispute: toPublicDispute(dispute, req.user!.userId) });
}
