import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  acceptOrderByFarmer,
  cancelOrderByBuyer,
  confirmReceiptByBuyer,
  createOrder,
  dispatchOrderByFarmer,
  getOrder,
  getOrderThread,
  listOrders,
  refreshPayment,
  startPayment,
} from '../controllers/orderController';
import { cancelOrderSchema, createOrderSchema, farmerDispatchSchema } from '../validation/orderSchemas';

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many orders from this account' } },
});

export const orderRouter = Router();

orderRouter.use(verifyToken);

orderRouter.get('/', listOrders);
orderRouter.get('/:id', getOrder);
orderRouter.get('/:id/thread', getOrderThread);
orderRouter.post('/', requireSessionRole('buyer'), orderLimiter, validateBody(createOrderSchema), createOrder);
orderRouter.post('/:id/pay', requireSessionRole('buyer'), startPayment);
orderRouter.post('/:id/payment-check', requireSessionRole('buyer'), refreshPayment);
orderRouter.post('/:id/accept', requireSessionRole('farmer'), acceptOrderByFarmer);
orderRouter.post('/:id/dispatch', requireSessionRole('farmer'), validateBody(farmerDispatchSchema), dispatchOrderByFarmer);
orderRouter.post('/:id/confirm', requireSessionRole('buyer'), confirmReceiptByBuyer);
orderRouter.post('/:id/cancel', requireSessionRole('buyer', 'admin'), validateBody(cancelOrderSchema), cancelOrderByBuyer);
