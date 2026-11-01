import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateProfileSchema } from '../validation/authSchemas';
import { updateProfile } from '../controllers/userController';

const profileLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

export const userRouter = Router();

userRouter.put('/profile', verifyToken, profileLimiter, validateBody(updateProfileSchema), updateProfile);
