import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { attachUserIfPresent, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createComplaintSchema } from '../validation/complaintSchemas';
import { createComplaint, listMyComplaints } from '../controllers/supportController';

const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many reports from this device' } },
});

export const supportRouter = Router();

supportRouter.post('/complaints', complaintLimiter, attachUserIfPresent, validateBody(createComplaintSchema), createComplaint);
supportRouter.get('/complaints', verifyToken, listMyComplaints);
