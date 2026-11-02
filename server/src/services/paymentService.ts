import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const REQUEST_TIMEOUT_MS = 15_000;

export interface CheckoutRequest {
  reference: string;
  /** Amount in kobo. Paystack charges the smallest unit, so nothing is rounded here. */
  amountKobo: number;
  email: string;
  phone: string;
  fullName: string;
  orderCode: string;
}

export interface CheckoutResult {
  provider: 'mock' | 'paystack';
  reference: string;
  /** Where the browser goes to pay. The mock page is served by this API. */
  authorizationUrl: string;
}

export interface PaymentVerification {
  verified: boolean;
  reference: string;
  amountKobo: number;
  channel?: string;
}

export function isMockPayment(): boolean {
  return env.PAYMENT_PROVIDER === 'mock';
}

export function newPaymentReference(orderId: string): string {
  return `hl_${orderId.slice(-8)}_${randomBytes(5).toString('hex')}`;
}

export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  if (isMockPayment()) {
    createMockCheckoutRecord(request.reference, request.amountKobo);
    // The mock page posts back to /payments/mock/complete, which is refused once NODE_ENV is production.
    const url = `${env.PUBLIC_APP_URL}/checkout/mock?reference=${encodeURIComponent(request.reference)}&order=${encodeURIComponent(request.orderCode)}&amountKobo=${request.amountKobo}`;
    logger.info('Mock checkout created', { reference: request.reference, orderCode: request.orderCode });
    return { provider: 'mock', reference: request.reference, authorizationUrl: url };
  }

  const response = await paystack('/transaction/initialize', 'POST', {
    email: request.email,
    amount: request.amountKobo,
    currency: 'NGN',
    reference: request.reference,
    phone: request.phone,
    metadata: { order_code: request.orderCode, customer: request.fullName },
    callback_url: `${env.PUBLIC_APP_URL}/orders/return?reference=${encodeURIComponent(request.reference)}`,
  });

  const data = response.data as { authorization_url?: string; access_code?: string; reference?: string };
  if (!data.authorization_url) throw new ApiError(502, 'PAYMENT_INIT_FAILED', 'The payment provider did not return a checkout link');

  return {
    provider: 'paystack',
    reference: data.reference ?? request.reference,
    authorizationUrl: data.authorization_url,
  };
}

export async function verifyCheckout(reference: string): Promise<PaymentVerification> {
  if (isMockPayment()) {
    const record = mockRecords.get(reference);
    if (!record) return { verified: false, reference, amountKobo: 0 };
    return { verified: true, reference, amountKobo: record.amountKobo, channel: 'mock' };
  }

  const response = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`, 'GET');
  const data = response.data as { status?: string; amount?: number; reference?: string; channel?: string };

  return {
    verified: data.status === 'success',
    reference: data.reference ?? reference,
    amountKobo: data.amount ?? 0,
    channel: data.channel,
  };
}

/**
 * Paystack moves money back on its own schedule, so a refund request is accepted rather than
 * confirmed. The reference is kept on the order so a support call can quote it.
 */
export async function refundPayment(reference: string, amountKobo: number): Promise<string> {
  if (isMockPayment()) {
    const id = `mock_refund_${randomBytes(4).toString('hex')}`;
    logger.info('Mock refund accepted', { reference, amountKobo, refundReference: id });
    return id;
  }

  const response = await paystack('/refund', 'POST', { transaction: reference, amount: amountKobo });
  const data = response.data as { reference?: string };
  if (!data.reference) throw new ApiError(502, 'REFUND_FAILED', 'The payment provider did not accept the refund');
  return data.reference;
}

/**
 * A webhook is only trusted when the HMAC over the exact bytes matches, so the raw body is
 * compared rather than a re-serialized copy of it.
 */
export function isTrustedWebhook(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature || !env.PAYSTACK_WEBHOOK_SECRET) return false;

  const expected = createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const actual = Buffer.from(expected, 'utf8');

  // A length mismatch would throw inside timingSafeEqual, and a forged signature is the case
  // this guard exists for.
  if (provided.length !== actual.length) return false;
  return timingSafeEqual(provided, actual);
}

interface MockRecord {
  amountKobo: number;
  createdAt: Date;
}

/**
 * Test only bookkeeping for PAYMENT_PROVIDER=mock. It lives in memory on purpose: nothing real
 * is being charged, and a restart should not leave half paid orders looking settled.
 */
const mockRecords = new Map<string, MockRecord>();

export function createMockCheckoutRecord(reference: string, amountKobo: number): void {
  mockRecords.set(reference, { amountKobo, createdAt: new Date() });
}

export function completeMockCheckout(reference: string): void {
  if (!mockRecords.has(reference)) {
    throw ApiError.notFound('That checkout link has expired. Start the payment again.');
  }
}

async function paystack(path: string, method: 'GET' | 'POST', body?: unknown): Promise<{ status: boolean; data: unknown }> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new ApiError(500, 'PAYMENT_NOT_CONFIGURED', 'Payments are switched on but the secret key is missing');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('Paystack rejected the request', { path, status: response.status, detail: detail.slice(0, 200) });
    throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'The payment provider is not answering. Try again shortly.');
  }

  return (await response.json()) as { status: boolean; data: unknown };
}
