import { Router } from 'express';
import { authRouter } from './authRoutes';
import { supportRouter } from './supportRoutes';
import { uploadRouter } from './uploadRoutes';
import { userRouter } from './userRoutes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/support', supportRouter);
apiRouter.use('/uploads', uploadRouter);
