import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  addDisputeEvidence,
  createDispute,
  getDispute,
  listMyDisputes,
  removeDisputeEvidence,
} from '../controllers/disputeController';
import { createDisputeSchema } from '../validation/disputeSchemas';
import { imageUpload } from '../services/imageStore';

const disputeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many cases opened in a row' } },
});

export const disputeRouter = Router();

disputeRouter.use(verifyToken, requireSessionRole('buyer', 'farmer'));

disputeRouter.get('/', listMyDisputes);
disputeRouter.get('/:id', getDispute);
disputeRouter.post('/', disputeLimiter, imageUpload.array('images'), validateBody(createDisputeSchema), createDispute);
disputeRouter.post('/:id/evidence', disputeLimiter, imageUpload.array('images'), addDisputeEvidence);
disputeRouter.delete('/:id/evidence', removeDisputeEvidence);
