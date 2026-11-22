import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { Complaint, toPublicComplaint } from '../models/Complaint';
import { Dispute, toPublicDispute } from '../models/Dispute';
import { Listing, toPublicListing } from '../models/Listing';
import { Order, toPublicOrder } from '../models/Order';
import { loadSettings, toPublicSettings } from '../models/PlatformSettings';
import { Settlement, toPublicSettlement } from '../models/Settlement';
import { User, toPublicUser, type KycStatus } from '../models/User';
import { releaseSettlement, refundOrder } from '../services/orderFlow';
import { sendSupportReply } from '../services/supportMessages';
import type {
  ReviewComplaintInput,
  ReviewKycInput,
  SettingsInput,
  UserListQuery,
} from '../validation/adminSchemas';
import { reviewComplaintSchema, reviewKycSchema, settingsSchema, userListQuerySchema } from '../validation/adminSchemas';
import { resolveDisputeSchema, type ResolveDisputeInput } from '../validation/disputeSchemas';
import { moderateListingSchema } from '../validation/listingSchemas';

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function dashboardCounts(req: Request, res: Response): Promise<void> {
  const [
    buyers,
    farmers,
    drivers,
    activeListings,
    awaitingPayment,
    funded,
    preparing,
    onTheRoad,
    confirmed,
    completed,
    refunded,
    openComplaints,
    openDisputes,
    kycWaiting,
    money,
  ] = await Promise.all([
    User.countDocuments({ role: 'buyer', isActive: true }),
    User.countDocuments({ role: 'farmer', isActive: true }),
    User.countDocuments({ role: 'driver', isActive: true }),
    Listing.countDocuments({ status: 'active' }),
    Order.countDocuments({ status: 'awaiting_payment' }),
    Order.countDocuments({ status: 'funded' }),
    Order.countDocuments({ status: 'preparing' }),
    Order.countDocuments({ status: 'out_for_delivery' }),
    Order.countDocuments({ status: 'confirmed' }),
    Order.countDocuments({ status: 'completed' }),
    Order.countDocuments({ status: 'refunded' }),
    Complaint.countDocuments({ status: 'open' }),
    Dispute.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    User.countDocuments({ role: 'farmer', 'farmerProfile.status': 'submitted' }),
    Settlement.aggregate([
      { $group: { _id: '$status', totalKobo: { $sum: '$netKobo' }, count: { $sum: 1 } } },
    ]),
  ]);

  const payoutRow = (status: string) => money.find((row) => row._id === status);

  sendSuccess(res, {
    counts: {
      buyers,
      farmers,
      drivers,
      activeListings,
      orders: { awaitingPayment, funded, preparing, onTheRoad, confirmed, completed, refunded },
      openComplaints,
      openDisputes,
      kycWaiting,
      payouts: {
        pendingKobo: payoutRow('pending')?.totalKobo ?? 0,
        heldKobo: payoutRow('held')?.totalKobo ?? 0,
        releasedKobo: payoutRow('released')?.totalKobo ?? 0,
      },
    },
  });
}

export async function listComplaints(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;

  const complaints = await Complaint.find(filter).sort({ status: 1, createdAt: -1 }).limit(100);
  sendSuccess(res, {
    complaints: complaints.map((complaint) => ({
      ...toPublicComplaint(complaint),
      reporterName: complaint.reporterName,
      reporterEmail: complaint.reporterEmail,
      reporterPhone: complaint.reporterPhone,
    })),
  });
}

export async function reviewComplaint(req: Request, res: Response): Promise<void> {
  const input = reviewComplaintSchema.parse(req.body) as ReviewComplaintInput;
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw ApiError.notFound('That report no longer exists');

  complaint.status = input.status;
  complaint.adminResponse = input.response;
  complaint.handledAt = new Date();
  await complaint.save();

  // The reply goes straight to the address on the report, whether or not the person has an
  // account. Delivery is fail-soft so Brevo being down cannot undo a saved decision.
  try {
    await sendSupportReply(complaint, input.response);
  } catch (err) {
    logger.error('Support reply email failed', err instanceof Error ? err.message : String(err));
  }

  sendSuccess(res, { complaint: toPublicComplaint(complaint) });
}

export async function listKycQueue(req: Request, res: Response): Promise<void> {
  const status = ((req.query.status as string | undefined) ?? 'submitted') as KycStatus;
  const users = await User.find({ role: 'farmer', 'farmerProfile.status': status })
    .sort({ updatedAt: -1 })
    .limit(100);

  sendSuccess(res, {
    farmers: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
      /** Staff read the full account number to match it against the name before approving. */
      profile: user.toObject().farmerProfile ?? null,
    })),
  });
}

export async function reviewKyc(req: Request, res: Response): Promise<void> {
  const input = reviewKycSchema.parse(req.body) as ReviewKycInput;
  const farmer = await User.findById(req.params.userId);
  if (!farmer || farmer.role !== 'farmer') throw ApiError.notFound('That farmer does not exist');
  if (!farmer.farmerProfile) throw ApiError.conflict('That farmer has not sent anything yet');

  farmer.farmerProfile.status = input.decision;
  farmer.farmerProfile.reviewNote = input.note;
  farmer.farmerProfile.reviewedAt = new Date();
  await farmer.save();

  // Approval is what unlocks payouts, so the records already held back for this farmer move now.
  if (input.decision === 'approved') {
    const held = await Settlement.find({ farmerId: farmer._id, status: 'held' });
    for (const settlement of held) {
      const order = await Order.findById(settlement.orderId).select('disputeOpen');
      if (!order || order.disputeOpen) continue;
      settlement.status = 'pending';
      settlement.note = undefined;
      await settlement.save();
    }
  }

  logger.info('KYC reviewed', { userId: farmer.id, decision: input.decision });
  sendSuccess(res, { farmer: toPublicUser(farmer) });
}

export async function listSettlements(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;

  const settlements = await Settlement.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('farmerId', 'fullName farmerProfile')
    .populate('orderId', 'orderCode');

  sendSuccess(res, { settlements: settlements.map(toPublicSettlement) });
}

export async function releaseSettlementById(req: Request, res: Response): Promise<void> {
  const { reference } = req.body as { reference?: string };
  if (!reference || reference.trim().length < 4) throw ApiError.badRequest('Add the transfer reference so this payout can be traced');

  const existing = await Settlement.findById(req.params.id);
  if (!existing) throw ApiError.notFound('That payout does not exist');

  const order = await Order.findById(existing.orderId)
    .populate('buyerId', 'fullName')
    .populate('farmerId', 'fullName')
    .populate('driverId', 'fullName');
  if (!order) throw ApiError.notFound('The order behind that payout is gone');

  const { settlement } = await releaseSettlement(order, req.user!.userId, reference.trim());

  sendSuccess(res, { settlement: toPublicSettlement(settlement), order: toPublicOrder(order, req.user!) });
}

export async function listAllDisputes(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;

  const disputes = await Dispute.find(filter)
    .sort({ status: 1, createdAt: -1 })
    .limit(100)
    .populate('orderId', 'orderCode totalKobo buyerId farmerId')
    .populate('openedById', 'fullName');

  sendSuccess(res, { disputes: disputes.map((dispute) => toPublicDispute(dispute, req.user!.userId)) });
}

export async function ruleDispute(req: Request, res: Response): Promise<void> {
  const input = resolveDisputeSchema.parse(req.body) as ResolveDisputeInput;
  const dispute = await Dispute.findById(req.params.id).populate('orderId');
  if (!dispute) throw ApiError.notFound('That case no longer exists');
  if (dispute.status !== 'open' && dispute.status !== 'in_review') throw ApiError.conflict('That case is already closed');

  const order = await Order.findById(dispute.orderId).populate('buyerId', 'fullName').populate('farmerId', 'fullName');
  if (!order) throw ApiError.notFound('The order behind that case is gone');

  if (input.outcome === 'refund') {
    await refundOrder(order, `Dispute ${dispute.id}: ${input.note}`);
    await Settlement.updateOne(
      { orderId: order._id, status: { $ne: 'released' } },
      { $set: { status: 'held', note: 'Refunded to the buyer after a dispute' } }
    );
    dispute.status = 'refund_agreed';
  } else {
    // Only a payout this case froze goes back to the queue, never one held for missing verification.
    await Settlement.updateOne(
      { orderId: order._id, status: 'held', note: 'Held while a dispute is open' },
      { $set: { status: 'pending', note: undefined } }
    );
    dispute.status = 'release_agreed';
  }

  order.disputeOpen = false;
  await order.save();

  dispute.resolutionNote = input.note;
  dispute.resolvedById = req.user!.userId;
  dispute.resolvedAt = new Date();
  await dispute.save();
  await dispute.populate('orderId', 'orderCode totalKobo');

  logger.info('Dispute ruled', { disputeId: dispute.id, outcome: input.outcome, orderCode: order.orderCode });
  sendSuccess(res, { dispute: toPublicDispute(dispute, req.user!.userId), order: toPublicOrder(order, req.user!) });
}

export async function listAllOrders(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('buyerId', 'fullName email phoneNumber')
    .populate('farmerId', 'fullName email phoneNumber')
    .populate('driverId', 'fullName phoneNumber');

  sendSuccess(res, { orders: orders.map((order) => toPublicOrder(order, req.user!)) });
}

export async function moderateListing(req: Request, res: Response): Promise<void> {
  const input = moderateListingSchema.parse(req.body) as { action: 'restore' | 'remove'; reason?: string };
  const listing = await Listing.findById(req.params.id).populate('farmerId', 'fullName farmerProfile.status');
  if (!listing) throw ApiError.notFound('That listing no longer exists');
  if (input.action === 'restore' && listing.status === 'sold') throw ApiError.conflict('That listing sold out, so it cannot be put back on sale');

  listing.status = input.action === 'remove' ? 'removed' : 'active';
  if (input.action === 'remove') listing.soldAt = undefined;
  await listing.save();

  logger.info('Listing moderated', { listingId: listing.id, action: input.action, reason: input.reason });
  sendSuccess(res, { listing: toPublicListing(listing, req.user!.userId) });
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = userListQuerySchema.parse(req.query) as UserListQuery;
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.q) {
    const pattern = new RegExp(escapeForRegex(query.q), 'i');
    filter.$or = [{ fullName: pattern }, { email: pattern }, { phoneNumber: pattern }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ]);

  sendSuccess(res, {
    users: users.map(toPublicUser),
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    total,
  });
}

export async function readSettings(req: Request, res: Response): Promise<void> {
  const settings = await loadSettings();
  sendSuccess(res, { settings: toPublicSettings(settings) });
}

export async function writeSettings(req: Request, res: Response): Promise<void> {
  const input = settingsSchema.parse(req.body) as SettingsInput;
  const settings = await loadSettings();

  Object.assign(settings, input);
  await settings.save();

  logger.info('Platform settings updated', { commissionBps: settings.commissionBps, paymentsOpen: settings.paymentsOpen });
  sendSuccess(res, { settings: toPublicSettings(settings) });
}

/** Not every setting belongs on a public page, so this only answers the checkout gate. */
export async function publicSettings(req: Request, res: Response): Promise<void> {
  const settings = await loadSettings();
  sendSuccess(res, {
    settings: {
      paymentsOpen: settings.paymentsOpen,
      commissionBps: settings.commissionBps,
      disputeWindowDays: settings.disputeWindowDays,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      maintenanceNote: settings.maintenanceNote,
    },
  });
}
