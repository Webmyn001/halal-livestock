import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  confirmPhone,
  forgotPassword,
  login,
  me,
  register,
  resendVerification,
  requestPhoneCode,
  resetPassword,
  verifyEmail,
} from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  confirmPhoneSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validation/authSchemas';

const rateMessage = (minutes: number) => ({
  success: false,
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Try again in a few minutes.',
    details: { retryAfterMinutes: minutes },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateMessage(15),
});

// Recovery mails cost money and are the usual spam target, so they get their own tighter budget.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateMessage(15),
});

// Opening a link and typing the new password are retries a careful user will hit, so they are not
// counted together with the mail budget.
const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateMessage(15),
});

const codeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateMessage(10),
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.get('/me', verifyToken, me);

authRouter.post('/verify-email', linkLimiter, validateBody(verifyEmailSchema), verifyEmail);
authRouter.post(
  '/resend-verification',
  recoveryLimiter,
  validateBody(forgotPasswordSchema),
  resendVerification
);
authRouter.post(
  '/forgot-password',
  recoveryLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword
);
authRouter.post(
  '/reset-password',
  linkLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
);

authRouter.post(
  '/phone/send-code',
  codeLimiter,
  verifyToken,
  requestPhoneCode
);
authRouter.post(
  '/phone/confirm',
  authLimiter,
  verifyToken,
  validateBody(confirmPhoneSchema),
  confirmPhone
);
