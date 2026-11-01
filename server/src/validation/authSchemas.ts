import { z } from 'zod';
import { emailField, passwordField, phoneNumberField } from './fields';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailField,
  phoneNumber: phoneNumberField,
  password: passwordField,
  // Self-registration is limited to marketplace roles; admin accounts are provisioned internally.
  role: z.enum(['buyer', 'farmer']),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: phoneNumberField.optional(),
});

const recoveryToken = z.string().trim().min(20).max(200);

export const verifyEmailSchema = z.object({ token: recoveryToken });

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number'),
});

export const resetPasswordSchema = z.object({
  token: recoveryToken,
  password: passwordField,
});

export const confirmPhoneSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the six digit code we sent you'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ConfirmPhoneInput = z.infer<typeof confirmPhoneSchema>;
