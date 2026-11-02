import { Router } from 'express';
import { authRouter } from './authRoutes';
import { listingRouter } from './listingRoutes';
import { supportRouter } from './supportRoutes';
import { userRouter } from './userRoutes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/listings', listingRouter);
apiRouter.use('/support', supportRouter);
