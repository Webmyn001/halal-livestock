import { z } from 'zod';
import { COMPLAINT_CATEGORIES } from '../models/Complaint';
import { emailField, phoneNumberField } from './fields';

export const createComplaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'Choose what your report is about' }),
  message: z
    .string()
    .trim()
    .min(20, 'Please give us at least a sentence or two so we can act on it')
    .max(2000, 'Keep the report under 2000 characters'),
  orderReference: z.string().trim().max(40).optional(),
  reporterName: z.string().trim().min(2).max(120).optional(),
  reporterEmail: emailField.optional(),
  reporterPhone: phoneNumberField.optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
