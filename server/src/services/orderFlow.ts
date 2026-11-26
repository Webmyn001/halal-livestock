import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { refId } from '../utils/refId';
import { logger } from '../utils/logger';
import { Listing } from '../models/Listing';
import { createAppNotification } from './appNotificationService';
import { Order, type OrderDoc } from '../models/Order';
import { Settlement, type SettlementDoc } from '../models/Settlement';
import { User } from '../models/User';
import { loadSettings, splitCommission } from '../models/PlatformSettings';
import { sendEmail } from './notificationService';
import { refundPayment } from './paymentService';

const MAX_CODE_ATTEMPTS = 5;

type ActorRole = 'buyer' | 'farmer' | 'admin' | 'driver' | 'system';

function pushTimeline(
  order: OrderDoc,
  event: { actorRole: ActorRole; actorId?: string; type: string; label: string; note?: string; at?: Date }
): void {
  order.timeline = order.timeline ?? [];
  order.timeline.push({
    at: event.at ?? new Date(),
    actorRole: event.actorRole,
    actorId: event.actorId,
    type: event.type,
    label: event.label,
    note: event.note,
  });
}

async function notifyUser(userId: string, title: string, message: string, link: string, tone: 'info' | 'success' | 'warning' = 'info'): Promise<void> {
  try {
    await createAppNotification({ userId, kind: 'order', title, message, tone, link, isRead: false, readBy: [] });
  } catch (err) {
    logger.error('Could not create in-app notification', { userId, title, message: (err as Error).message });
  }
}

async function notifyRole(role: 'admin', title: string, message: string, link: string, tone: 'info' | 'success' | 'warning' = 'info'): Promise<void> {
  try {
    await createAppNotification({ recipientRole: role, kind: 'order', title, message, tone, link, isRead: false, readBy: [] });
  } catch (err) {
    logger.error('Could not create role notification', { role, title, message: (err as Error).message });
  }
}

function orderLink(order: OrderDoc): string {
  return `/orders/${order.id}`;
}

function syncPayoutStatus(order: OrderDoc): void {
  if (order.status === 'completed') {
    order.payoutStatus = 'paid';
    return;
  }
  if (order.disputeOpen || order.status === 'disputed') {
    order.payoutStatus = 'held';
    return;
  }
  if (['confirmed', 'awaiting_farmer_payout'].includes(order.status)) {
    order.payoutStatus = 'awaiting_payout';
    return;
  }
  if (order.payoutStatus === 'paid') return;
  if (['refunded', 'cancelled', 'awaiting_payment'].includes(order.status)) {
    order.payoutStatus = 'not_eligible';
  }
}

export function isDeliveryOverdue(order: OrderDoc, now = Date.now()): boolean {
  return Boolean(
    order.expectedDeliveryAt &&
      !order.confirmedAt &&
      !order.disputeOpen &&
      ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(order.status) &&
      order.expectedDeliveryAt.getTime() < now
  );
}

export async function flagOverdueIfNeeded(order: OrderDoc): Promise<boolean> {
  if (!isDeliveryOverdue(order)) return false;
  if (order.deliveryStatus === 'delivery_overdue' && order.status === 'delivery_overdue') return false;

  order.deliveryStatus = 'delivery_overdue';
  order.status = 'delivery_overdue';
  pushTimeline(order, {
    actorRole: 'system',
    type: 'delivery_overdue',
    label: 'Delivery marked overdue',
    note: order.expectedDeliveryAt ? `Expected by ${order.expectedDeliveryAt.toISOString()}` : undefined,
  });
  await order.save();

  const link = orderLink(order);
  await notifyUser(refId(order.buyerId), 'Delivery overdue', `Order ${order.orderCode} has passed its expected delivery time. Please confirm receipt or report a problem.`, link, 'warning');
  await notifyRole('admin', 'Delivery overdue', `Order ${order.orderCode} is overdue and needs attention.`, link, 'warning');
  return true;
}

export async function createOrderCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const date = new Date();
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const code = `HL-${y}${m}${d}-${suffix}`;
    const clash = await Order.exists({ orderCode: code });
    if (!clash) return code;
  }
  throw new Error('Could not reserve an order code');
}

/**
 * Stock is taken with a conditional update, so two buyers cannot both reserve the same last
 * animal. A rejected reservation says so instead of silently going negative.
 */
export async function reserveStock(listingId: Types.ObjectId, quantity: number): Promise<void> {
  const result = await Listing.updateOne(
    { _id: listingId, status: 'active', quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } }
  );

  if (result.modifiedCount !== 1) {
    const listing = await Listing.findById(listingId).select('quantity status').lean();
    throw ApiError.conflict(
      !listing || listing.status !== 'active'
        ? listing?.status === 'sold'
          ? 'That livestock has already been sold'
          : listing?.status === 'under_process'
            ? 'That livestock is currently under process of being sold to another buyer'
            : 'That listing is no longer on sale'
        : `Only ${listing.quantity} left on that listing. Reduce the quantity and try again.`
    );
  }

  const remaining = await Listing.findById(listingId).select('quantity').lean();
  if (remaining && remaining.quantity <= 0) {
    await Listing.updateOne({ _id: listingId }, { $set: { status: 'under_process' } });
  }
}

export async function releaseStock(listingId: Types.ObjectId, quantity: number): Promise<void> {
  await Listing.updateOne(
    { _id: listingId },
    {
      $inc: { quantity: quantity },
      $set: { status: 'active' },
      $unset: { soldAt: 1 },
    }
  );
}

export async function markFunded(order: OrderDoc, reference: string, amountKobo: number, provider: string): Promise<OrderDoc> {
  if (order.paymentState === 'held') return order;

  if (amountKobo !== order.totalKobo) {
    logger.error('Paid amount does not match the order total', {
      orderCode: order.orderCode,
      expectedKobo: order.totalKobo,
      paidKobo: amountKobo,
    });
    throw ApiError.conflict('The amount paid does not match this order. Support has been notified.');
  }

  order.status = 'funded';
  order.paymentState = 'held';
  order.paymentReference = reference;
  order.paymentProvider = provider;
  order.paidAt = new Date();
  order.preparationStatus = 'awaiting_preparation';
  order.deliveryStatus = 'awaiting_dispatch';
  order.buyerConfirmationStatus = 'not_required';
  order.payoutStatus = 'not_eligible';
  pushTimeline(order, { actorRole: 'system', type: 'payment_success', label: 'Payment successful', note: `Reference ${reference}` });
  pushTimeline(order, { actorRole: 'system', type: 'awaiting_preparation', label: 'Awaiting farmer preparation' });
  await order.save();

  const link = orderLink(order);
  await notifyUser(refId(order.buyerId), 'Payment successful', `Your payment for ${order.orderCode} was successful. Order is now being processed.`, link, 'success');
  await notifyUser(refId(order.farmerId), 'Payment received! Start preparing livestock', `New paid order ${order.orderCode} received. Payment has been confirmed - start preparing livestock for delivery.`, link, 'success');
  await notifyRole('admin', 'New successful transaction', `Order ${order.orderCode} has been paid successfully and is awaiting farmer preparation.`, link, 'info');
  await notifyFarmer(order);
  return order;
}

export async function acceptOrder(order: OrderDoc): Promise<OrderDoc> {
  if (!['funded', 'awaiting_farmer_payout'].includes(order.status) && order.status !== 'funded') {
    // fallthrough to explicit check below
  }
  if (order.status !== 'funded') throw ApiError.conflict('This order is not waiting on you');
  order.status = 'preparing';
  order.preparationStatus = 'preparing';
  order.deliveryStatus = 'awaiting_dispatch';
  order.acceptedAt = new Date();
  pushTimeline(order, { actorRole: 'farmer', actorId: refId(order.farmerId), type: 'preparation_started', label: 'Farmer started preparing livestock' });
  await order.save();
  await notifyUser(refId(order.buyerId), 'Farmer is preparing your livestock', `The farmer has started preparing ${order.orderCode}.`, orderLink(order), 'info');
  await notifyRole('admin', 'Farmer started preparation', `Farmer started preparation for ${order.orderCode}.`, orderLink(order), 'info');
  return order;
}

export async function startPreparation(order: OrderDoc, actorId: string): Promise<OrderDoc> {
  if (refId(order.farmerId) !== actorId) throw ApiError.forbidden('Only the farmer can start preparation');
  return acceptOrder(order);
}

export async function dispatchOrder(order: OrderDoc, driverId: string): Promise<{ code: string }> {
  if (order.status !== 'preparing' && order.status !== 'funded') {
    throw ApiError.conflict('Only an order you have accepted can go out for delivery');
  }

  const driver = await User.findById(driverId).select('fullName isActive role').lean();
  if (!driver || driver.role !== 'driver' || !driver.isActive) throw ApiError.badRequest('Choose an active driver');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  order.confirmationCode = code;
  order.confirmationCodeAttempts = 0;
  order.driverId = new Types.ObjectId(driverId);
  order.status = 'out_for_delivery';
  order.preparationStatus = 'ready_for_dispatch';
  order.deliveryStatus = 'in_transit';
  order.buyerConfirmationStatus = 'pending';
  order.dispatchedAt = new Date();
  pushTimeline(order, { actorRole: 'admin', type: 'dispatched', label: 'Order dispatched with driver', note: `Driver: ${driver.fullName}` });
  await order.save();

  await notifyUser(refId(order.buyerId), 'Livestock dispatched', `Order ${order.orderCode} is on the way. Confirm receipt when it arrives.`, orderLink(order), 'info');
  await deliverCode(order, driver.fullName, code);
  return { code };
}

export async function dispatchByFarmer(
  order: OrderDoc,
  actorId: string,
  input: { etaValue: number; etaUnit: 'hours' | 'days'; note?: string }
): Promise<OrderDoc> {
  if (refId(order.farmerId) !== actorId) throw ApiError.forbidden('Only the farmer can dispatch this order');
  if (!['preparing', 'funded'].includes(order.status)) {
    throw ApiError.conflict('Start preparation before dispatching this order');
  }
  if (order.disputeOpen) throw ApiError.conflict('A disputed order cannot be dispatched');

  const dispatchedAt = new Date();
  const ms = input.etaUnit === 'days' ? input.etaValue * 24 * 60 * 60 * 1000 : input.etaValue * 60 * 60 * 1000;
  const expectedDeliveryAt = new Date(dispatchedAt.getTime() + ms);

  order.status = 'out_for_delivery';
  order.preparationStatus = 'ready_for_dispatch';
  order.deliveryStatus = 'in_transit';
  order.buyerConfirmationStatus = 'pending';
  if (!order.acceptedAt) order.acceptedAt = dispatchedAt;
  order.dispatchedAt = dispatchedAt;
  order.deliveryEtaValue = input.etaValue;
  order.deliveryEtaUnit = input.etaUnit;
  order.expectedDeliveryAt = expectedDeliveryAt;
  order.deliveryNote = input.note;
  pushTimeline(order, {
    actorRole: 'farmer',
    actorId,
    type: 'dispatched',
    label: 'Livestock dispatched by farmer',
    note: `ETA: ${input.etaValue} ${input.etaUnit}. ${input.note ?? ''}`.trim(),
  });
  await order.save();

  await notifyUser(
    refId(order.buyerId),
    'Your livestock is in transit',
    `Order ${order.orderCode} is in transit. Expected arrival: ${expectedDeliveryAt.toLocaleString()}. Please confirm when received.`,
    orderLink(order),
    'info'
  );
  await notifyRole('admin', 'Order dispatched', `Order ${order.orderCode} was dispatched by the farmer.`, orderLink(order), 'info');
  return order;
}

export async function confirmHandover(order: OrderDoc, code: string): Promise<OrderDoc> {
  if (order.status !== 'out_for_delivery' && order.status !== 'awaiting_buyer_confirmation' && order.status !== 'delivery_overdue') {
    throw ApiError.conflict('This delivery is not on the road');
  }
  if (!order.confirmationCode) throw ApiError.conflict('No handover code has been issued for this order');

  if (order.confirmationCodeAttempts >= MAX_CODE_ATTEMPTS) {
    throw ApiError.conflict('Too many wrong codes. Ask support to send a new one.');
  }

  if (code !== order.confirmationCode) {
    order.confirmationCodeAttempts += 1;
    await order.save();
    throw ApiError.badRequest('That code does not match. Check it with the buyer.');
  }

  return completeBuyerConfirmation(order, 'driver', refId(order.driverId));
}

export async function confirmByBuyer(order: OrderDoc): Promise<OrderDoc> {
  const allowed: string[] = ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'preparing'];
  if (!allowed.includes(order.status)) {
    throw ApiError.conflict('You can only confirm receipt after the order has been dispatched or is ready for confirmation.');
  }
  if (order.disputeOpen) throw ApiError.conflict('This order has an open dispute. Resolve it before confirming receipt.');
  return completeBuyerConfirmation(order, 'buyer', refId(order.buyerId));
}

async function completeBuyerConfirmation(order: OrderDoc, actorRole: ActorRole, actorId: string): Promise<OrderDoc> {
  if (order.buyerConfirmationStatus === 'confirmed' || ['confirmed', 'awaiting_farmer_payout', 'completed'].includes(order.status)) {
    return order;
  }

  order.status = 'confirmed';
  order.buyerConfirmationStatus = 'confirmed';
  order.deliveryStatus = 'delivered';
  order.confirmedAt = new Date();
  order.payoutStatus = 'awaiting_payout';
  pushTimeline(order, {
    actorRole,
    actorId,
    type: 'buyer_confirmed',
    label: 'Buyer confirmed receipt',
    note: actorRole === 'driver' ? 'Confirmed via driver handover code.' : 'Confirmed by buyer in dashboard.',
  });
  await order.save();

  const listing = await Listing.findById(order.listingId).select('quantity status').lean();
  if (listing && (listing.quantity <= 0 || listing.status === 'under_process')) {
    await Listing.updateOne({ _id: listing._id }, { $set: { status: 'sold', soldAt: new Date() } });
  }

  await buildSettlement(order);
  syncPayoutStatus(order);
  await order.save();

  const link = orderLink(order);
  await notifyUser(refId(order.buyerId), 'Delivery confirmed', `Your delivery for ${order.orderCode} has been confirmed. Thank you for choosing HalalLivestock.`, link, 'success');
  await notifyUser(refId(order.farmerId), 'Buyer confirmed delivery', `Buyer confirmed delivery for ${order.orderCode}. Awaiting admin payout processing.`, link, 'success');
  await notifyRole('admin', 'Ready for payout review', `Buyer confirmed delivery for ${order.orderCode}. Payout is ready for review.`, link, 'info');
  return order;
}

export async function cancelOrder(order: OrderDoc, reason: string): Promise<OrderDoc> {
  if (order.status === 'awaiting_payment') {
    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();
    order.payoutStatus = 'not_eligible';
    pushTimeline(order, { actorRole: 'buyer', actorId: refId(order.buyerId), type: 'cancelled', label: 'Order cancelled before payment', note: reason });
    await order.save();
    await releaseStock(order.listingId as Types.ObjectId, order.quantity);
    return order;
  }

  if (order.status === 'funded' || order.status === 'preparing') {
    const refundReference = await refundPayment(order.paymentReference!, order.totalKobo);
    order.status = 'refunded';
    order.paymentState = 'refunded';
    order.cancelReason = reason;
    order.cancelledAt = new Date();
    order.refundReference = refundReference;
    order.refundedAt = new Date();
    order.payoutStatus = 'not_eligible';
    pushTimeline(order, { actorRole: 'system', type: 'refunded', label: 'Order refunded', note: reason });
    await order.save();
    await releaseStock(order.listingId as Types.ObjectId, order.quantity);
    await notifyUser(refId(order.buyerId), 'Order refunded', `Order ${order.orderCode} was refunded.`, orderLink(order), 'warning');
    await notifyUser(refId(order.farmerId), 'Order cancelled/refunded', `Order ${order.orderCode} was cancelled and refunded.`, orderLink(order), 'warning');
    return order;
  }

  throw ApiError.conflict('This order cannot be cancelled at this stage. Report a problem instead.');
}

export async function refundOrder(order: OrderDoc, reason: string): Promise<OrderDoc> {
  const refundReference = await refundPayment(order.paymentReference!, order.totalKobo);
  order.status = 'refunded';
  order.paymentState = 'refunded';
  order.cancelReason = reason;
  order.refundReference = refundReference;
  order.refundedAt = new Date();
  order.payoutStatus = 'not_eligible';
  pushTimeline(order, { actorRole: 'admin', type: 'refunded', label: 'Refund issued', note: reason });
  await order.save();
  return order;
}

async function buildSettlement(order: OrderDoc): Promise<void> {
  const existing = await Settlement.findOne({ orderId: order._id });
  if (existing) {
    order.settlementId = existing._id;
    order.payoutStatus = existing.status === 'released' ? 'paid' : existing.status === 'held' ? 'held' : 'awaiting_payout';
    return;
  }

  const [settings, farmer] = await Promise.all([
    loadSettings(),
    User.findById(order.farmerId).select('farmerProfile fullName email phoneNumber').lean(),
  ]);

  if (!farmer) throw new Error('The farmer on this order no longer exists');

  const { commissionKobo, netKobo } = splitCommission(order.totalKobo, settings.commissionBps);
  const bank = farmer.farmerProfile;
  const canPay = bank?.status === 'approved' && bank.accountNumber && bank.bankName && bank.accountName;

  const settlement = await Settlement.create({
    orderId: order._id,
    farmerId: order.farmerId,
    grossKobo: order.totalKobo,
    commissionKobo,
    netKobo,
    status: canPay ? 'pending' : 'held',
    note: canPay ? undefined : 'Waiting on the farmer to finish verification',
  });

  order.settlementId = settlement._id;
  order.payoutStatus = canPay ? 'awaiting_payout' : 'held';
  pushTimeline(order, {
    actorRole: 'system',
    type: 'payout_eligible',
    label: canPay ? 'Payout awaiting admin processing' : 'Payout held pending farmer verification',
  });
}

export async function releaseSettlement(
  order: OrderDoc,
  actorId: string,
  reference: string,
  options?: { note?: string; payoutEvidence?: string }
): Promise<{ order: OrderDoc; settlement: SettlementDoc }> {
  const settlement = await Settlement.findById(order.settlementId)
    .populate('orderId', 'orderCode')
    .populate('farmerId', 'fullName farmerProfile');
  if (!settlement) throw ApiError.notFound('No payout has been raised for this order');
  if (settlement.status === 'released') throw ApiError.conflict('This payout has already been released');
  if (order.disputeOpen) throw ApiError.conflict('A dispute is open on this order. Settle it first.');

  const farmer = await User.findById(settlement.farmerId).select('farmerProfile').lean();
  const bank = farmer?.farmerProfile;
  if (!bank || bank.status !== 'approved' || !bank.accountNumber || !bank.bankName || !bank.accountName) {
    throw ApiError.conflict('This farmer has no approved bank account, so the payout cannot be released');
  }

  settlement.status = 'released';
  settlement.bank = { bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber };
  settlement.reference = reference;
  settlement.releasedAt = new Date();
  settlement.releasedById = actorId;
  settlement.payoutEvidence = options?.payoutEvidence?.trim() || undefined;
  settlement.note = options?.note?.trim() || undefined;
  await settlement.save();

  order.status = 'completed';
  order.payoutStatus = 'paid';
  pushTimeline(order, { actorRole: 'admin', actorId, type: 'payout_released', label: 'Farmer payout released', note: `Reference ${reference}` });
  await order.save();

  const listing = await Listing.findById(order.listingId).select('quantity status').lean();
  if (listing && (listing.quantity <= 0 || listing.status === 'under_process') && listing.status !== 'removed') {
    await Listing.updateOne({ _id: listing._id }, { $set: { status: 'sold', soldAt: new Date() } });
  }

  await notifyUser(refId(order.farmerId), 'Payout successful', `Payout successful for ${order.orderCode}. Funds have been transferred. Reference: ${reference}.`, orderLink(order), 'success');
  await notifyUser(refId(order.buyerId), 'Order completed', `Order ${order.orderCode} is complete. Thank you for choosing HalalLivestock.`, orderLink(order), 'success');
  return { order, settlement };
}

async function notifyFarmer(order: OrderDoc): Promise<void> {
  const farmer = await User.findById(order.farmerId).select('fullName email').lean();
  if (!farmer) return;

  const subject = `New paid order ${order.orderCode}`;
  const text = `Hello ${farmer.fullName},\n\nPayment has been received for ${order.quantity} ${order.snapshot.unit} on "${order.snapshot.title}". Order ${order.orderCode}. Open your farmer dashboard to start preparation.\n\nHalal Livestocks`;

  await tryNotify(async () => {
    await sendEmail({ to: farmer.email, subject, text, html: `<p>${text.replace(/\n/g, '<br>')}</p>` });
  }, 'order paid notice', order.orderCode);
}

async function deliverCode(order: OrderDoc, driverName: string, code: string): Promise<void> {
  const buyer = await User.findById(order.buyerId).select('email').lean();
  if (!buyer) return;

  const body = `Your Halal Livestocks order ${order.orderCode} is on the way with ${driverName}. Check the animals, then read this code to the driver: ${code}. The driver needs it before the payment is released.`;

  await tryNotify(async () => {
    await sendEmail({ to: buyer.email, subject: `Your handover code for ${order.orderCode}`, text: body, html: `<p>${body}</p>` });
  }, 'handover code email', order.orderCode);
}

async function tryNotify(task: () => Promise<void>, label: string, orderCode: string): Promise<void> {
  try {
    await task();
  } catch (err) {
    logger.error(`Could not send the ${label}`, { orderCode, message: (err as Error).message });
  }
}
