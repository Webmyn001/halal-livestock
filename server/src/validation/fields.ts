import { z } from 'zod';
import { E164_PATTERN, toE164 } from '../utils/phone';

export const emailField = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const phoneNumberField = z
  .string()
  .trim()
  .min(7, 'Enter your phone number')
  .transform(toE164)
  .pipe(z.string().regex(E164_PATTERN, 'Enter a valid number, e.g. 08031234567 or +2348031234567'));

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
