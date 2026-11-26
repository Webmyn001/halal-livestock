import type { Request, Response } from 'express';
import { Notification, toPublicNotification, type NotificationRole, type NotificationTone } from '../models/Notification';
import { createAppNotification } from '../services/appNotificationService';
import { getPublicVapidKey, isPushConfigured, removePushSubscription, savePushSubscription } from '../services/pushService';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { sendEmail } from '../services/notificationService';
import { logger } from '../utils/logger';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const role = req.user!.role as NotificationRole;

  const docs = await Notification.find({
    $or: [{ userId }, { recipientRole: { $in: [role, 'all'] } }],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  const notifications = docs.map((doc) => toPublicNotification(doc, userId));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  sendSuccess(res, { notifications, unreadCount });
}

export async function markNotificationsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const role = req.user!.role as NotificationRole;
  const { id } = req.body as { id?: string };

  if (id) {
    const doc = await Notification.findById(id);
    if (doc) {
      if (doc.userId === userId) {
        doc.isRead = true;
        await doc.save();
      } else if (doc.recipientRole && [role, 'all'].includes(doc.recipientRole)) {
        if (!doc.readBy.includes(userId)) {
          doc.readBy.push(userId);
          await doc.save();
        }
      }
    }
  } else {
    // Mark all as read
    await Promise.all([
      Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } }),
      Notification.updateMany(
        { recipientRole: { $in: [role, 'all'] }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      ),
    ]);
  }

  sendSuccess(res, { success: true });
}

export async function adminSendNotification(req: Request, res: Response): Promise<void> {
  const { target, userId, role, title, message, tone = 'info', link } = req.body as {
    target: 'user' | 'role' | 'all';
    userId?: string;
    role?: NotificationRole;
    title: string;
    message: string;
    tone?: NotificationTone;
    link?: string;
  };

  if (!title || !message) {
    throw ApiError.badRequest('Please provide both a title and message');
  }

  let emailRecipients: Array<{ email: string; fullName: string }> = [];

  if (target === 'user') {
    if (!userId) throw ApiError.badRequest('Select a user to message');
    const user = await User.findById(userId).select('email fullName isActive').lean();
    if (!user) throw ApiError.notFound('User not found');

    await createAppNotification({
      userId: String(user._id),
      kind: 'support',
      senderName: 'Admin Halallivestock',
      title: title.trim(),
      message: message.trim(),
      tone,
      link: link?.trim() || undefined,
    });

    if (user.isActive && user.email) {
      emailRecipients.push({ email: user.email, fullName: user.fullName });
    }
  } else {
    const targetRole = target === 'all' ? 'all' : (role || 'all');
    await createAppNotification({
      recipientRole: targetRole,
      kind: 'support',
      senderName: 'Admin Halallivestock',
      title: title.trim(),
      message: message.trim(),
      tone,
      link: link?.trim() || undefined,
    });

    const filter: Record<string, unknown> = { isActive: true };
    if (targetRole !== 'all') filter.role = targetRole;

    const users = await User.find(filter).select('email fullName').limit(500).lean();
    emailRecipients = users.map((u) => ({ email: u.email, fullName: u.fullName }));
  }

  // Deliver email to recipients in background
  const emailSubject = `[Halal Livestocks] ${title.trim()}`;
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1917; line-height: 1.6;">
      <h2 style="color: #14532d; margin-bottom: 16px;">${title.trim()}</h2>
      <p style="white-space: pre-wrap; font-size: 15px; color: #44403c;">${message.trim()}</p>
      ${link ? `<div style="margin-top: 24px;"><a href="${link}" style="background-color: #15803d; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Open in App</a></div>` : ''}
      <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e7e5e4;" />
      <p style="font-size: 12px; color: #78716c;">This is an official message from the Halal Livestocks administrative team.</p>
    </div>
  `;

  // Send emails with Promise.allSettled
  Promise.allSettled(
    emailRecipients.map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject: emailSubject,
        text: `${title.trim()}\n\n${message.trim()}`,
        html: emailHtml,
      })
    )
  ).catch((err) => {
    logger.error('Failed to dispatch notification emails', { error: err });
  });

  logger.info('Admin notification dispatched', {
    target,
    userId,
    role,
    title,
    recipientCount: emailRecipients.length,
  });

  sendSuccess(res, {
    sent: true,
    recipientsNotified: emailRecipients.length,
    message: `Message sent to ${emailRecipients.length} user(s) and posted to their in-app alarm notification.`,
  });
}

export async function getPushPublicKey(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    enabled: isPushConfigured(),
    publicKey: getPublicVapidKey(),
  });
}

export async function subscribePush(req: Request, res: Response): Promise<void> {
  if (!isPushConfigured()) throw ApiError.badRequest('Push notifications are not configured on this server');

  const { endpoint, keys, expirationTime } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    expirationTime?: number | null;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw ApiError.badRequest('Invalid push subscription payload');
  }

  await savePushSubscription(
    req.user!.userId,
    { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, expirationTime: expirationTime ?? null },
    req.header('user-agent') ?? undefined
  );

  sendSuccess(res, { subscribed: true });
}

export async function unsubscribePush(req: Request, res: Response): Promise<void> {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) throw ApiError.badRequest('Subscription endpoint is required');
  await removePushSubscription(req.user!.userId, endpoint);
  sendSuccess(res, { subscribed: false });
}
