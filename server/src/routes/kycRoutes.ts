import { Router } from 'express';
import { requireEmailVerified, requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { submitKyc, withdrawDocument } from '../controllers/kycController';
import { submitKycSchema } from '../validation/kycSchemas';
import { imageUpload } from '../services/imageStore';

export const kycRouter = Router();

kycRouter.use(verifyToken, requireSessionRole('farmer'), requireEmailVerified);

kycRouter.post('/', imageUpload.single('document'), validateBody(submitKycSchema), submitKyc);
kycRouter.delete('/document', withdrawDocument);
