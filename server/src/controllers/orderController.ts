import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { Listing } from '../models/Listing';
import { Order, toPublicOrder, type OrderDoc } from '../models/Order';
import { User } from '../models/User';
import { loadSettings } from '../models/PlatformSettings';
import { createCheckout, newPaymentReference, verifyCheckout } from '../services/paymentService';
import { Conversation, Message, toPublicMessage } from '../models/Chat';
import { acceptOrder, cancelOrder, confirmByBuyer, createOrderCode, dispatchByFarmer, flagOverdueIfNeeded, markFunded, releaseStock, reserveStock } from '../services/orderFlow';
import {
  cancelOrderSchema,
  createOrderSchema,
  farmerDispatchSchema,
  orderListQuerySchema,
  type CancelOrderInput,
  type CreateOrderInput,
  type FarmerDispatchInput,
} from '../validation/orderSchemas';

const PARTIES = 'fullName email phoneNumber';
const DRIVER_FIELDS = 'fullName phoneNumber';

async function findVisibleOrder(req: Request): Promise<OrderDoc> {
  const order = await Order.findById(req.params.id)
    .select('+confirmationCode')
    .populate('buyerId', PARTIES)
    .populate('farmerId', PARTIES)
    .populate('driverId', DRIVER_FIELDS)
    .populate('settlementId');

  if (!order) throw ApiError.notFound('That order no longer exists');

  const viewer = req.user!;
  const mine =
    String(order.buyerId?._id ?? '') === viewer.userId ||
    String(order.farmerId?._id ?? '') === viewer.userId ||
    String(order.driverId?._id ?? '') === viewer.userId;

  if (!mine && viewer.role !== 'admin') throw ApiError.forbidden('That order is not yours');
  await flagOverdueIfNeeded(order);
  return order;
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateOrderInput;
  const settings = await loadSettings();

  if (!settings.paymentsOpen) {
    throw ApiError.conflict(settings.maintenanceNote || 'Checkout is paused for a short while. Try again shortly.');
  }

  const listing = await Listing.findById(input.listingId);
  if (!listing) throw ApiError.notFound('That listing no longer exists');
  if (listing.status === 'sold' || listing.quantity <= 0) throw ApiError.conflict('This livestock item has already been sold');
  if (listing.status === 'under_process') throw ApiError.conflict('This livestock item is currently under process with another buyer');
  if (listing.status !== 'active') throw ApiError.notFound('That listing is no longer on sale');
  if (String(listing.farmerId) === req.user!.userId) throw ApiError.forbidden('You cannot buy from your own listing');

  const totalKobo = listing.priceKobo * input.quantity;
  if (totalKobo > 10_000_000_000) throw ApiError.badRequest('That order is too large for one checkout. Split it into two orders.');

  // Stock moves first so two buyers racing the same animal cannot both reach a checkout page.
  await reserveStock(listing._id, input.quantity);

  try {
    const order = await Order.create({
      orderCode: await createOrderCode(),
      listingId: listing._id,
      farmerId: listing.farmerId,
      buyerId: req.user!.userId,
      quantity: input.quantity,
      totalKobo,
      note: input.note,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      address: input.address,
      town: input.town,
      state: input.state,
      wantedDate: input.wantedDate,
      snapshot: {
        title: listing.title,
        species: listing.species,
        listingType: listing.listingType,
        unit: listing.unit,
        priceKobo: listing.priceKobo,
        coverImage: listing.images[0]?.url ?? '',
        town: listing.town,
        state: listing.state,
      },
    });

    await Conversation.create({ orderId: order._id, buyerId: req.user!.userId, farmerId: listing.farmerId });

    await order.populate('farmerId', PARTIES);
    sendSuccess(res, { order: toPublicOrder(order, req.user!) }, 201);
  } catch (err) {
    // Nothing was written, so the animals have to go back on sale.
    await releaseStock(listing._id, input.quantity);
    throw err;
  }
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const query = orderListQuerySchema.parse(req.query);
  const viewer = req.user!;

  const filter: Record<string, unknown> = {};
  const scope = query.scope ?? (viewer.role === 'farmer' ? 'farmer' : viewer.role === 'buyer' ? 'buyer' : 'all');

  if (scope === 'buyer') filter.buyerId = viewer.userId;
  else if (scope === 'farmer') filter.farmerId = viewer.userId;
  else if (viewer.role !== 'admin') filter.$or = [{ buyerId: viewer.userId }, { farmerId: viewer.userId }, { driverId: viewer.userId }];

  if (query.status) filter.status = query.status;
  if (viewer.role === 'driver') filter.status = 'out_for_delivery';

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('buyerId', PARTIES)
      .populate('farmerId', PARTIES)
      .populate('driverId', DRIVER_FIELDS),
  ]);

  await Promise.all(orders.map((order) => flagOverdueIfNeeded(order)));

  sendSuccess(res, {
    orders: orders.map((order) => toPublicOrder(order, viewer)),
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    total,
  });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

/** The buyer opens the thread from the order page, so the conversation is created on demand. */
export async function getOrderThread(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);
  const conversation = await Conversation.findOne({ orderId: order._id });
  if (!conversation) throw ApiError.notFound('This order has no message thread yet');

  const messages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('senderId', 'fullName');

  const viewer = req.user!;
  // An admin can read the thread, but only a party clears a counter, and only their own.
  const role: 'buyer' | 'farmer' | 'viewer' =
    String(order.buyerId?._id ?? '') === viewer.userId ? 'buyer' : String(order.farmerId?._id ?? '') === viewer.userId ? 'farmer' : 'viewer';
  if (role === 'buyer') conversation.buyerUnread = 0;
  if (role === 'farmer') conversation.farmerUnread = 0;
  if (role !== 'viewer') await conversation.save();

  sendSuccess(res, {
    conversation: { id: conversation.id, orderCode: order.orderCode, role },
    messages: messages.map(toPublicMessage),
  });
}

export async function startPayment(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);

  if (String(order.buyerId?._id ?? '') !== req.user!.userId) throw ApiError.forbidden('Only the buyer can pay for this order');
  if (order.status !== 'awaiting_payment') throw ApiError.conflict('This order is already paid or closed');

  const buyer = await User.findById(req.user!.userId).select('fullName email phoneNumber').lean();
  if (!buyer) throw ApiError.unauthorized('Sign in again to continue');

  if (!order.paymentReference) order.paymentReference = newPaymentReference(order.id);
  await order.save();

  const checkout = await createCheckout({
    orderId: order.id,
    reference: order.paymentReference,
    amountKobo: order.totalKobo,
    email: buyer.email,
    phone: order.contactPhone,
    fullName: buyer.fullName,
    orderCode: order.orderCode,
  });

  sendSuccess(res, { checkout });
}

export async function refreshPayment(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);

  if (order.status !== 'awaiting_payment') {
    sendSuccess(res, { order: toPublicOrder(order, req.user!), paid: order.paymentState === 'held' });
    return;
  }
  if (!order.paymentReference) throw ApiError.badRequest('Start the payment first');

  const check = await verifyCheckout(order.paymentReference);
  if (!check.verified) {
    sendSuccess(res, { order: toPublicOrder(order, req.user!), paid: false });
    return;
  }

  await markFunded(order, check.reference, check.amountKobo, check.channel ?? 'unknown');
  await order.populate('farmerId', PARTIES);
  sendSuccess(res, { order: toPublicOrder(order, req.user!), paid: true });
}

export async function acceptOrderByFarmer(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);
  if (String(order.farmerId?._id ?? '') !== req.user!.userId) throw ApiError.forbidden('Only the farmer can accept this order');

  await acceptOrder(order);
  await order.populate('buyerId', PARTIES);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

export async function cancelOrderByBuyer(req: Request, res: Response): Promise<void> {
  const { reason } = cancelOrderSchema.parse(req.body) as CancelOrderInput;
  const order = await findVisibleOrder(req);

  const isBuyer = String(order.buyerId?._id ?? '') === req.user!.userId;
  if (!isBuyer && req.user!.role !== 'admin') throw ApiError.forbidden('Only the buyer can cancel this order');

  await cancelOrder(order, reason);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

/** Buyer directly marks the order as received — no driver code needed. */
export async function confirmReceiptByBuyer(req: Request, res: Response): Promise<void> {
  const order = await findVisibleOrder(req);
  if (String(order.buyerId?._id ?? '') !== req.user!.userId) throw ApiError.forbidden('Only the buyer can confirm receipt');

  await confirmByBuyer(order);
  await order.populate('farmerId', PARTIES);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

export async function dispatchOrderByFarmer(req: Request, res: Response): Promise<void> {
  const input = farmerDispatchSchema.parse(req.body) as FarmerDispatchInput;
  const order = await findVisibleOrder(req);
  await dispatchByFarmer(order, req.user!.userId, { etaValue: input.etaValue, etaUnit: input.etaUnit, note: input.note });
  await order.populate('buyerId', PARTIES);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}
