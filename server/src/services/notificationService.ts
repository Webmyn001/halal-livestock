import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.MAIL_PROVIDER === 'brevo') {
    await deliverWithBrevo(message);
    return;
  }

  // Development and test only: the whole body goes to the log so links and codes are usable.
  logger.info('Email queued (console transport)', { to: message.to, subject: message.subject, body: message.text });
}

async function deliverWithBrevo(message: EmailMessage): Promise<void> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'api-key': env.BREVO_API_KEY!,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM_EMAIL },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('Brevo rejected the message', { status: response.status, detail: detail.slice(0, 300) });
    throw new Error('Email delivery failed');
  }
}
