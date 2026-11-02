import { z } from 'zod';
import { ID_TYPES } from '../models/User';

const accountNumber = z
  .string()
  .trim()
  .regex(/^[0-9]{10,11}$/, 'Enter the ten or eleven digit account number');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * Everything needed to pay a farmer out. The document photo is optional because a lot of farmers
 * in the state photograph an ID on a phone badly; an admin can still ask for it later.
 */
export const submitKycSchema = z
  .object({
    farmName: z.string().trim().min(2).max(120),
    businessName: optionalText(120),
    address: z.string().trim().min(6).max(200),
    town: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    idType: z.enum(ID_TYPES, { message: 'Choose the ID you have' }),
    idNumber: z.string().trim().min(4).max(40),
    cacNumber: optionalText(40),
    bankName: z.string().trim().min(2).max(60),
    accountName: z.string().trim().min(2).max(120),
    accountNumber,
  })
  .strict();

export type SubmitKycInput = z.infer<typeof submitKycSchema>;
