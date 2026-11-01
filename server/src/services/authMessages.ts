import { env } from '../config/env';
import type { UserDoc } from '../models/User';
import { sendEmail, sendSms } from './notificationService';

const BRAND = '#0e6c49';
const INK = '#14181f';
const MUTED = '#6b7280';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character] ?? character;
  });
}

function firstName(user: UserDoc): string {
  return user.fullName.split(' ')[0] ?? 'there';
}

function layout(heading: string, paragraphs: string[], action?: { label: string; url: string }, footer?: string): string {
  const button = action
    ? `<tr><td style="padding:26px 0 6px">
        <a href="${action.url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;
          font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;padding:13px 26px;border-radius:10px">${action.label}</a>
      </td></tr>
      <tr><td style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13px;color:${MUTED};line-height:1.6">
        If the button does not work, copy this address into your browser:<br>
        <span style="color:${INK};word-break:break-all">${action.url}</span>
      </td></tr>`
    : '';

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f5f5f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:30px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;
        border-radius:16px;overflow:hidden;border:1px solid #e7e5e4">
        <tr><td style="background:#062c20;padding:18px 28px">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:${BRAND};
            border-radius:7px;color:#ffffff;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;font-weight:700">HL</span>
          <span style="margin-left:9px;color:#ffffff;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600">
            Halal Livestocks</span>
        </td></tr>
        <tr><td style="padding:30px 28px 26px">
          <h1 style="margin:0 0 14px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:21px;line-height:1.3;color:${INK}">${heading}</h1>
          ${paragraphs
            .map(
              (paragraph) =>
                `<p style="margin:0 0 13px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.65;color:#374151">${paragraph}</p>`
            )
            .join('')}
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${button}</table>
        </td></tr>
        <tr><td style="padding:16px 28px 22px;border-top:1px solid #e7e5e4;font-family:Inter,Segoe UI,Arial,sans-serif;
          font-size:12px;line-height:1.6;color:${MUTED}">
          ${footer ?? 'You are getting this because somebody used your details on Halal Livestocks. If that was not you, ignore this message.'}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendEmailVerification(user: UserDoc, token: string): Promise<void> {
  const url = `${env.PUBLIC_APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Confirm your email address',
    text: `Hello ${firstName(user)},\n\nConfirm your email address for Halal Livestocks. This link works once and expires in 24 hours.\n\n${url}\n\nIf you did not ask for this, ignore the message.`,
    html: layout(
      `Confirm your email, ${escapeHtml(firstName(user))}`,
      [
        'One click and your account can receive delivery codes, payout notices and replies from the support team.',
        'This link works once and expires in 24 hours.',
      ],
      { label: 'Confirm my email', url }
    ),
  });
}

export async function sendPasswordReset(user: UserDoc, token: string): Promise<void> {
  const url = `${env.PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Set a new password',
    text: `Hello ${firstName(user)},\n\nWe received a request to reset your Halal Livestocks password. This link works once and expires in 30 minutes.\n\n${url}\n\nIf you did not ask for this, nothing else needs doing. Your current password still works.`,
    html: layout(
      'Set a new password',
      [
        'We received a request to reset the password on your account.',
        'This link works once and expires in 30 minutes. Your current password keeps working until you set a new one.',
      ],
      { label: 'Choose a new password', url },
      'If you did not ask for this, you can leave it alone. No change happens unless the link is opened and a new password is saved.'
    ),
  });
}

export async function sendPhoneOtp(user: UserDoc, code: string): Promise<void> {
  await sendSms(
    user.phoneNumber,
    `${code} is your Halal Livestocks code. It expires in 10 minutes. Do not share it with anyone.`
  );
}
