import { z } from 'zod';
import { COMPLAINT_STATUSES } from '../models/Complaint';

export const reviewComplaintSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES.filter((status) => status !== 'open'), { message: 'Choose a status' }),
  response: z.string().trim().min(5).max(2000),
});

export const reviewKycSchema = z.object({
  decision: z.enum(['approved', 'rejected'], { message: 'Approve or reject the details' }),
  note: z.string().trim().min(5).max(500),
});

export const releaseSettlementSchema = z.object({
  reference: z.string().trim().min(4).max(120),
  note: z.string().trim().max(500).optional(),
  payoutEvidence: z.string().trim().max(1000).optional(),
});

export const settingsSchema = z
  .object({
    commissionBps: z.coerce.number().int().min(0).max(5_000),
    disputeWindowDays: z.coerce.number().int().min(0).max(30),
    supportEmail: z.string().trim().min(5).max(120),
    supportPhone: z.string().trim().min(7).max(20),
    paymentsOpen: z.boolean(),
    maintenanceNote: z.string().trim().max(300).optional(),
  })
  .strict();

export const moderateListingSchema = z.object({
  action: z.enum(['restore', 'remove'], { message: 'Choose restore or remove' }),
  reason: z.string().trim().min(5).max(300).optional(),
});

export const userListQuerySchema = z.object({
  role: z.enum(['buyer', 'farmer', 'driver', 'admin']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReviewComplaintInput = z.infer<typeof reviewComplaintSchema>;
export type ReviewKycInput = z.infer<typeof reviewKycSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
