import { z } from 'zod';
import { phoneNumberField } from './fields';

const futureDate = z.coerce
  .date({ message: 'Choose the day you want the animals' })
  .refine((value) => value.getTime() >= Date.now() - 12 * 60 * 60 * 1000, 'That date has already passed');

export const createOrderSchema = z.object({
  listingId: z.string().trim().min(1, 'Choose the listing you want to buy'),
  quantity: z.coerce.number().int().min(1, 'Order at least one'),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: phoneNumberField,
  address: z.string().trim().min(6).max(200),
  town: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  wantedDate: futureDate.optional(),
  note: z.string().trim().max(500).optional(),
});

export const orderListQuerySchema = z.object({
  scope: z.enum(['buyer', 'farmer', 'all']).optional(),
  status: z
    .enum([
      'awaiting_payment',
      'funded',
      'preparing',
      'out_for_delivery',
      'awaiting_buyer_confirmation',
      'delivery_overdue',
      'confirmed',
      'awaiting_farmer_payout',
      'completed',
      'cancelled',
      'refunded',
      'disputed',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(6).max(300),
});

export const dispatchSchema = z.object({
  driverId: z.string().trim().min(1, 'Choose a driver'),
});

export const farmerDispatchSchema = z.object({
  etaValue: z.coerce.number().int().min(1).max(720),
  etaUnit: z.enum(['hours', 'days']),
  note: z.string().trim().max(500).optional(),
});

export const handoverSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the six digit code the buyer gave you'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
export type FarmerDispatchInput = z.infer<typeof farmerDispatchSchema>;
export type HandoverInput = z.infer<typeof handoverSchema>;
