import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { listMyThreads, postMessage, readThread } from '../controllers/chatController';
import { sendMessageSchema } from '../validation/chatSchemas';

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down a moment' } },
});

export const chatRouter = Router();

chatRouter.use(verifyToken, requireSessionRole('buyer', 'farmer'));

chatRouter.get('/', listMyThreads);
chatRouter.get('/:id', readThread);
chatRouter.post('/:id/messages', messageLimiter, validateBody(sendMessageSchema), postMessage);
