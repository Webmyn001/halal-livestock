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

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verify over the exact bytes Paystack signed. A JSON parser that re-serializes the body changes
 * spacing and number formats, so the signature no longer matches.
 *
 * Current integrations send `Paystack-Signature` with a timestamp and a `whsec_` signing secret.
 * Older integrations still send `x-paystack-signature`, which is signed with the secret key. Both
 * are accepted so a dashboard secret can be rotated without a webhook outage.
 */
export function isTrustedWebhook(
  rawBody: Buffer | undefined,
  legacySignature: string | undefined,
  signedHeader?: string | undefined
): boolean {
  if (!rawBody) return false;

  if (signedHeader && env.PAYSTACK_WEBHOOK_SECRET && verifySignedHeader(rawBody, signedHeader, env.PAYSTACK_WEBHOOK_SECRET)) {
    return true;
  }

  if (legacySignature && env.PAYSTACK_SECRET_KEY && verifyLegacySignature(rawBody, legacySignature, env.PAYSTACK_SECRET_KEY)) {
    return true;
  }

  // Keeps deployments that still put the secret key in PAYSTACK_WEBHOOK_SECRET working.
  if (
    legacySignature &&
    env.PAYSTACK_WEBHOOK_SECRET &&
    verifyLegacySignature(rawBody, legacySignature, env.PAYSTACK_WEBHOOK_SECRET)
  ) {
    return true;
  }

  return false;
}

function verifySignedHeader(rawBody: Buffer, header: string, secret: string): boolean {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  // `t=1760270400,v1=whk_<key id>:<hex>`. An event may carry several v1 entries during a secret
  // rotation, so collect all of them and accept if any matches. Ignore unknown fields.
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === 't') {
      if (timestamp !== undefined || !/^\d+$/.test(value)) return false;
      timestamp = Number(value);
    } else if (key === 'v1') {
      const colon = value.indexOf(':');
      if (colon > 0) signatures.push(value.slice(colon + 1));
    }
  }

  if (timestamp === undefined || signatures.length === 0) return false;

  // A replayed event must not be accepted forever.
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha512', secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some((hex) => /^[0-9a-f]{128}$/.test(hex) && verifyHex(expected, hex));
}

function verifyLegacySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{128}$/.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  return verifyHex(expected, signature);
}

function verifyHex(expected: Buffer, hex: string): boolean {
  const provided = Buffer.from(hex, 'hex');
  return provided.length === expected.length && timingSafeEqual(expected, provided);
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
