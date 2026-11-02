import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { Order, toPublicOrder } from '../models/Order';
import { User } from '../models/User';
import { confirmHandover, dispatchOrder } from '../services/orderFlow';
import { dispatchSchema, handoverSchema, type DispatchInput, type HandoverInput } from '../validation/orderSchemas';

const DRIVER_FIELDS = 'fullName phoneNumber';

export async function listMyDeliveries(req: Request, res: Response): Promise<void> {
  const orders = await Order.find({ driverId: req.user!.userId, status: 'out_for_delivery' })
    .sort({ dispatchedAt: 1 })
    .populate('buyerId', 'fullName phoneNumber')
    .populate('farmerId', 'fullName')
    .populate('driverId', DRIVER_FIELDS);

  sendSuccess(res, {
    deliveries: orders.map((order) => toPublicOrder(order, req.user!)),
  });
}

/** The driver has the animals; the buyer has the code. Nothing moves until the two meet. */
export async function submitHandoverCode(req: Request, res: Response): Promise<void> {
  const { code } = handoverSchema.parse(req.body) as HandoverInput;

  const order = await Order.findById(req.params.id)
    .select('+confirmationCode')
    .populate('buyerId', 'fullName phoneNumber')
    .populate('farmerId', 'fullName')
    .populate('driverId', DRIVER_FIELDS);

  if (!order) throw ApiError.notFound('That delivery no longer exists');
  if (String(order.driverId?._id ?? '') !== req.user!.userId) throw ApiError.forbidden('This delivery was not assigned to you');

  await confirmHandover(order, code);
  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

export async function dispatchOrderByAdmin(req: Request, res: Response): Promise<void> {
  const { driverId } = dispatchSchema.parse(req.body) as DispatchInput;

  const order = await Order.findById(req.params.id).populate('buyerId', 'fullName').populate('farmerId', 'fullName');
  if (!order) throw ApiError.notFound('That order no longer exists');
  if (order.disputeOpen) throw ApiError.conflict('A dispute is open on this order');

  await dispatchOrder(order, driverId);
  await order.populate('driverId', DRIVER_FIELDS);

  sendSuccess(res, { order: toPublicOrder(order, req.user!) });
}

export async function listDrivers(req: Request, res: Response): Promise<void> {
  const drivers = await User.find({ role: 'driver', isActive: true }).select('fullName phoneNumber email').sort({ fullName: 1 });
  sendSuccess(res, {
    drivers: drivers.map((driver) => ({ id: driver.id, fullName: driver.fullName, phoneNumber: driver.phoneNumber, email: driver.email })),
  });
}
