import { Router } from 'express';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { completeMockPayment, paystackWebhook } from '../controllers/paymentController';
import { z } from 'zod';

const mockSchema = z.object({ reference: z.string().trim().min(8).max(80) });

export const paymentRouter = Router();

// Paystack signs the raw body, so this route is mounted ahead of any authentication and any
// rewriting of the payload.
paymentRouter.post('/webhook', paystackWebhook);

paymentRouter.post('/mock/complete', verifyToken, requireSessionRole('buyer'), validateBody(mockSchema), completeMockPayment);
