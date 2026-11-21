import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required — paste your MongoDB Atlas connection string'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters of high-entropy randomness'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Transactional messages, and the only channel the app has: verification codes, handover codes
  // and payout notices all go out as email. 'console' prints to the log and is refused in production.
  MAIL_PROVIDER: z.enum(['console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().optional(),
  MAIL_FROM_EMAIL: z.string().optional(),
  MAIL_FROM_NAME: z.string().default('Halal Livestocks'),

  // Links inside emails point at the web app, which is a different origin to the API.
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),

  // Payments. 'mock' settles an order the moment its checkout link is opened and is refused in
  // production. 'paystack' talks to the real API and needs the keys below. The browser never holds
  // a Paystack key: it is sent the hosted checkout URL this API builds after verifying the amount.
  PAYMENT_PROVIDER: z.enum(['mock', 'paystack']).default('mock'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  // The value set on the Paystack dashboard for this webhook. The signature check is nothing
  // without it, so a production deployment cannot run without one.
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),

  // Image storage. 'local' writes under the server folder and is only allowed outside production.
  STORAGE_PROVIDER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  // Local files are served by this API, so image URLs must point here rather than at the web app.
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
})
  .refine(
    (value) => value.MAIL_PROVIDER !== 'console' || value.NODE_ENV !== 'production',
    { message: 'MAIL_PROVIDER must be brevo in production', path: ['MAIL_PROVIDER'] }
  )
  .refine(
    (value) => value.MAIL_PROVIDER !== 'brevo' || Boolean(value.BREVO_API_KEY && value.MAIL_FROM_EMAIL),
    { message: 'BREVO_API_KEY and MAIL_FROM_EMAIL are required when MAIL_PROVIDER=brevo', path: ['BREVO_API_KEY'] }
  )
  .refine(
    (value) => value.STORAGE_PROVIDER !== 'local' || value.NODE_ENV !== 'production',
    { message: 'STORAGE_PROVIDER must be cloudinary in production', path: ['STORAGE_PROVIDER'] }
  )
  .refine(
    (value) =>
      value.STORAGE_PROVIDER !== 'cloudinary' ||
      Boolean(value.CLOUDINARY_CLOUD_NAME && value.CLOUDINARY_API_KEY && value.CLOUDINARY_API_SECRET),
    {
      message:
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required when STORAGE_PROVIDER=cloudinary',
      path: ['CLOUDINARY_CLOUD_NAME'],
    }
  )
  .refine(
    (value) => value.PAYMENT_PROVIDER !== 'mock' || value.NODE_ENV !== 'production',
    { message: 'PAYMENT_PROVIDER must be paystack in production', path: ['PAYMENT_PROVIDER'] }
  )
  .refine(
    (value) =>
      value.PAYMENT_PROVIDER !== 'paystack' ||
      Boolean(value.PAYSTACK_SECRET_KEY && value.PAYSTACK_WEBHOOK_SECRET),
    {
      message:
        'PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET are required when PAYMENT_PROVIDER=paystack',
      path: ['PAYSTACK_SECRET_KEY'],
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;
