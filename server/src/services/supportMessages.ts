import { env } from '../config/env';
import type { ComplaintDoc } from '../models/Complaint';
import { sendEmail } from './notificationService';

const BRAND = '#0e6c49';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character] ?? character;
  });
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

/** The reply is the important part of the message, so it gets its own block. */
export async function sendSupportReply(complaint: ComplaintDoc, response: string): Promise<void> {
  const firstName = complaint.reporterName.trim().split(' ')[0] || 'there';
  const subject = `A reply from Halal Livestocks about your report`;
  const about = complaint.orderReference
    ? ` about order ${complaint.orderReference}`
    : ` about ${label(complaint.category)}`;

  const text = [
    `Hello ${firstName},`,
    '',
    `The admin team has replied to the report you sent us${about}.`,
    '',
    response,
    '',
    `Status: ${label(complaint.status)}.`,
    '',
    `If anything is still unclear, reply to this email or use the contact form at ${env.PUBLIC_APP_URL}/contact.`,
  ].join('\n');

  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#14181f;line-height:1.6">
      <p style="margin:0 0 16px">Hello ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px">The admin team has replied to the report you sent us${escapeHtml(about)}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
        <tr><td style="border-left:4px solid ${BRAND};background:#f5f7f6;padding:16px 20px;border-radius:0 10px 10px 0">
          <p style="margin:0;white-space:pre-wrap">${escapeHtml(response)}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 16px">Status: ${escapeHtml(label(complaint.status))}.</p>
      <p style="margin:0 0 8px">
        If anything is still unclear, reply to this email or use the
        <a href="${env.PUBLIC_APP_URL}/contact" style="color:${BRAND}">contact form</a>.
      </p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">Halal Livestocks · ${escapeHtml(env.MAIL_FROM_NAME)}</p>
    </div>`;

  await sendEmail({ to: complaint.reporterEmail, subject, text, html });
}
