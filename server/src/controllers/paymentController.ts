import type { Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { refId } from '../utils/refId';
import { logger } from '../utils/logger';
import { Order } from '../models/Order';
import { isTrustedWebhook, completeMockCheckout, verifyCheckout } from '../services/paymentService';
import { markFunded } from '../services/orderFlow';
import { z } from 'zod';

const mockReferenceSchema = z.object({ reference: z.string().trim().min(8).max(80) });

/**
 * Paystack calls this on its own schedule, sometimes before the browser comes back. The order is
 * matched on the reference that was sent at initialization, and the amount is checked, so a
 * replayed or partial payment cannot mark a bigger order as funded.
 */
export async function paystackWebhook(req: Request, res: Response): Promise<void> {
  if (env.PAYMENT_PROVIDER !== 'paystack') {
    sendSuccess(res, { ignored: 'this API is not running the paystack provider' }, 200);
    return;
  }

  if (!isTrustedWebhook(req.rawBody, req.header('x-paystack-signature'), req.header('paystack-signature'))) {
    logger.warn('Rejected an unverifiable Paystack webhook');
    throw ApiError.unauthorized('That webhook signature is not valid');
  }

  const body = (req.body ?? {}) as { event?: string; data?: { reference?: string; status?: string; amount?: number } };
  const event = body.event ?? '';
  const reference = body.data?.reference;

  if ((event === 'charge.success' || event === 'charge.complete') && reference && body.data?.amount) {
    const order = await Order.findOne({ paymentReference: reference });
    if (order) {
      try {
        await markFunded(order, reference, body.data.amount, 'paystack webhook');
        logger.info('Order funded by webhook', { orderCode: order.orderCode, reference });
      } catch (err) {
        logger.error('Webhook could not fund the order', { reference, message: (err as Error).message });
      }
    } else {
      logger.warn('Webhook referenced an unknown order', { reference });
    }
  }

  // Paystack retries anything that is not a 200, so a duplicate is acknowledged rather than fought.
  sendSuccess(res, { received: true }, 200);
}

/**
 * Development only. It marks the in memory checkout record as paid and funds the order through the
 * same path the real provider uses, so the rest of the flow stays honest.
 */
export async function completeMockPayment(req: Request, res: Response): Promise<void> {
  if (env.PAYMENT_PROVIDER !== 'mock') throw ApiError.notFound('That endpoint does not exist here');

  const { reference } = mockReferenceSchema.parse(req.body);
  const order = await Order.findOne({ paymentReference: reference });
  if (!order) throw ApiError.notFound('No order matches that checkout');
  if (refId(order.buyerId) !== req.user!.userId) throw ApiError.forbidden('That checkout is not yours');

  completeMockCheckout(reference);
  const check = await verifyCheckout(reference);
  if (!check.verified) throw ApiError.conflict('The checkout did not settle');

  await markFunded(order, reference, check.amountKobo, 'mock');
  sendSuccess(res, { order: { id: order.id, orderCode: order.orderCode, status: order.status } });
}
