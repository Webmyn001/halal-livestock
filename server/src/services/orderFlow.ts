import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { Listing } from '../models/Listing';
import { Order, type OrderDoc } from '../models/Order';
import { Settlement, type SettlementDoc } from '../models/Settlement';
import { User } from '../models/User';
import { loadSettings, splitCommission } from '../models/PlatformSettings';
import { sendEmail } from './notificationService';
import { refundPayment } from './paymentService';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_ATTEMPTS = 5;

/** Six characters that read back clearly over the phone: no I, O, 0 or 1. */
function randomOrderSuffix(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export async function createOrderCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `HL-${randomOrderSuffix()}`;
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

  // When all available stock is reserved, mark the listing as under process
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
  // A webhook and a browser can both report the same payment, so the second call is a no-op.
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
  await order.save();

  await notifyFarmer(order);
  return order;
}

export async function acceptOrder(order: OrderDoc): Promise<OrderDoc> {
  if (order.status !== 'funded') throw ApiError.conflict('This order is not waiting on you');
  order.status = 'preparing';
  order.acceptedAt = new Date();
  await order.save();
  return order;
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
  order.dispatchedAt = new Date();
  await order.save();

  await deliverCode(order, driver.fullName, code);
  return { code };
}

/**
 * The driver holds the animals until the buyer gives them the code, so a code match is what moves
 * money out of the platform's hold and into a payout for the farmer.
 */
export async function confirmHandover(order: OrderDoc, code: string): Promise<OrderDoc> {
  if (order.status !== 'out_for_delivery') throw ApiError.conflict('This delivery is not on the road');
  if (!order.confirmationCode) throw ApiError.conflict('No handover code has been issued for this order');

  if (order.confirmationCodeAttempts >= MAX_CODE_ATTEMPTS) {
    throw ApiError.conflict('Too many wrong codes. Ask support to send a new one.');
  }

  if (code !== order.confirmationCode) {
    order.confirmationCodeAttempts += 1;
    await order.save();
    throw ApiError.badRequest('That code does not match. Check it with the buyer.');
  }

  order.status = 'confirmed';
  order.confirmedAt = new Date();
  await order.save();

  // Mark listing as sold if quantity is 0 or it was under process
  const listing = await Listing.findById(order.listingId).select('quantity status').lean();
  if (listing && listing.quantity <= 0) {
    await Listing.updateOne({ _id: listing._id }, { $set: { status: 'sold', soldAt: new Date() } });
  }

  await buildSettlement(order);
  return order;
}

/**
 * Buyer directly confirms receipt of the animals (no driver/code required).
 * Used in the simplified delivery flow where buyer and farmer agree delivery themselves.
 */
export async function confirmByBuyer(order: OrderDoc): Promise<OrderDoc> {
  const allowed: string[] = ['out_for_delivery', 'preparing'];
  if (!allowed.includes(order.status)) {
    throw ApiError.conflict('You can only confirm receipt after the order has been accepted by the farmer.');
  }

  order.status = 'confirmed';
  order.confirmedAt = new Date();
  await order.save();

  // Mark listing as sold if quantity is 0 or it was under process
  const listing = await Listing.findById(order.listingId).select('quantity status').lean();
  if (listing && listing.quantity <= 0) {
    await Listing.updateOne({ _id: listing._id }, { $set: { status: 'sold', soldAt: new Date() } });
  }

  await buildSettlement(order);
  return order;
}

export async function cancelOrder(order: OrderDoc, reason: string): Promise<OrderDoc> {
  if (order.status === 'awaiting_payment') {
    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();
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
    await order.save();
    await releaseStock(order.listingId as Types.ObjectId, order.quantity);
    return order;
  }

  throw ApiError.conflict('The animals are already on the way. Raise a dispute instead of cancelling.');
}

/** Used by a dispute ruling, where the buyer keeps the hold but the order is not restocked. */
export async function refundOrder(order: OrderDoc, reason: string): Promise<OrderDoc> {
  const refundReference = await refundPayment(order.paymentReference!, order.totalKobo);
  order.status = 'refunded';
  order.paymentState = 'refunded';
  order.cancelReason = reason;
  order.refundReference = refundReference;
  order.refundedAt = new Date();
  await order.save();
  return order;
}

async function buildSettlement(order: OrderDoc): Promise<void> {
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
    // An unverified account is held back rather than paid, which is what keeps the farmer honest.
    status: canPay ? 'pending' : 'held',
    note: canPay ? undefined : 'Waiting on the farmer to finish verification',
  });

  order.settlementId = settlement._id;
  await order.save();
}

export async function releaseSettlement(order: OrderDoc, actorId: string, reference: string): Promise<{ order: OrderDoc; settlement: SettlementDoc }> {
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
  settlement.note = undefined;
  await settlement.save();

  order.status = 'completed';
  await order.save();

  // Sold out is a fact about the listing, not about this order, so it is set from the stock count.
  const listing = await Listing.findById(order.listingId).select('quantity status').lean();
  if (listing && listing.quantity <= 0 && listing.status !== 'removed') {
    await Listing.updateOne({ _id: listing._id }, { $set: { status: 'sold', soldAt: new Date() } });
  }

  return { order, settlement };
}

async function notifyFarmer(order: OrderDoc): Promise<void> {
  const farmer = await User.findById(order.farmerId).select('fullName email').lean();
  if (!farmer) return;

  const subject = `New paid order ${order.orderCode}`;
  const text = `Hello ${farmer.fullName},\n\nA buyer has paid ${formatNaira(order.totalKobo) } for ${order.quantity} ${order.snapshot.unit} on "${order.snapshot.title}". Order ${order.orderCode}. Open the farm dashboard to accept it.\n\nHalal Livestocks`;

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
  // A message failure must not undo a delivery or a payment, so it is logged and moved past.
  try {
    await task();
  } catch (err) {
    logger.error(`Could not send the ${label}`, { orderCode, message: (err as Error).message });
  }
}

function formatNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);
}
