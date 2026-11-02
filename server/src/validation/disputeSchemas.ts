import { z } from 'zod';
import { DISPUTE_REASONS } from '../models/Dispute';

export const createDisputeSchema = z.object({
  orderId: z.string().trim().min(1, 'Choose the order you have a problem with'),
  reason: z.enum(DISPUTE_REASONS, { message: 'Say what went wrong' }),
  description: z
    .string()
    .trim()
    .min(20, 'Describe what happened in at least a sentence')
    .max(2000, 'Keep the description under 2000 characters'),
});

export const disputeListQuerySchema = z.object({
  status: z.enum(['open', 'in_review', 'refund_agreed', 'release_agreed', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const resolveDisputeSchema = z.object({
  outcome: z.enum(['refund', 'release'], { message: 'Choose refund or release' }),
  note: z.string().trim().min(10).max(1000),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
