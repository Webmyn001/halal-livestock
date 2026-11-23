import { Router } from 'express';
import { adminRouter } from './adminRoutes';
import { authRouter } from './authRoutes';
import { chatRouter } from './chatRoutes';
import { deliveryRouter } from './deliveryRoutes';
import { disputeRouter } from './disputeRoutes';
import { kycRouter } from './kycRoutes';
import { listingRouter } from './listingRoutes';
import { orderRouter } from './orderRoutes';
import { paymentRouter } from './paymentRoutes';
import { notificationRouter } from './notificationRoutes';
import { supportRouter } from './supportRoutes';
import { userRouter } from './userRoutes';
import { publicSettings } from '../controllers/adminController';

export const apiRouter = Router();

apiRouter.get('/platform', publicSettings);

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/listings', listingRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/deliveries', deliveryRouter);
apiRouter.use('/disputes', disputeRouter);
apiRouter.use('/conversations', chatRouter);
apiRouter.use('/kyc', kycRouter);
apiRouter.use('/support', supportRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/admin', adminRouter);
