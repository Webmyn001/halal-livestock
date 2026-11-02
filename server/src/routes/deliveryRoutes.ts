import { Router } from 'express';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dispatchOrderByAdmin, listDrivers, listMyDeliveries, submitHandoverCode } from '../controllers/deliveryController';
import { dispatchSchema, handoverSchema } from '../validation/orderSchemas';

export const deliveryRouter = Router();

deliveryRouter.use(verifyToken);

deliveryRouter.get('/mine', requireSessionRole('driver'), listMyDeliveries);
deliveryRouter.get('/drivers', requireSessionRole('admin'), listDrivers);
deliveryRouter.post('/:id/dispatch', requireSessionRole('admin'), validateBody(dispatchSchema), dispatchOrderByAdmin);
deliveryRouter.post('/:id/handover', requireSessionRole('driver'), validateBody(handoverSchema), submitHandoverCode);
