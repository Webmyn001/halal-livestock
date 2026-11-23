import { Router } from 'express';
import { requireSessionRole, verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  dashboardCounts,
  listAllDisputes,
  listAllOrders,
  listComplaints,
  listKycQueue,
  listSettlements,
  listUsers,
  moderateListing,
  readSettings,
  releaseSettlementById,
  reviewComplaint,
  reviewKyc,
  ruleDispute,
  writeSettings,
} from '../controllers/adminController';
import { deleteListing } from '../controllers/listingController';
import { releaseSettlementSchema, reviewComplaintSchema, reviewKycSchema, settingsSchema } from '../validation/adminSchemas';
import {
  moderateListingSchema,
} from '../validation/listingSchemas';
import { resolveDisputeSchema } from '../validation/disputeSchemas';

export const adminRouter = Router();

adminRouter.use(verifyToken, requireSessionRole('admin'));

adminRouter.get('/counts', dashboardCounts);
adminRouter.get('/users', listUsers);

adminRouter.get('/complaints', listComplaints);
adminRouter.patch('/complaints/:id', validateBody(reviewComplaintSchema), reviewComplaint);

adminRouter.get('/kyc', listKycQueue);
adminRouter.post('/kyc/:userId', validateBody(reviewKycSchema), reviewKyc);

adminRouter.get('/orders', listAllOrders);
adminRouter.get('/settlements', listSettlements);
adminRouter.post('/settlements/:id/release', validateBody(releaseSettlementSchema), releaseSettlementById);

adminRouter.get('/disputes', listAllDisputes);
adminRouter.post('/disputes/:id/rule', validateBody(resolveDisputeSchema), ruleDispute);

adminRouter.post('/listings/:id/moderate', validateBody(moderateListingSchema), moderateListing);
adminRouter.delete('/listings/:id', deleteListing);

adminRouter.get('/settings', readSettings);
adminRouter.put('/settings', validateBody(settingsSchema), writeSettings);
