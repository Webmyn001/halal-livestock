import webpush from 'web-push';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { PushSubscription } from '../models/PushSubscription';
import { User } from '../models/User';
import type { NotificationDoc } from '../models/Notification';

let configured = false;

function ensureConfigured(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (configured) return true;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getPublicVapidKey(): string | null {
  return env.VAPID_PUBLIC_KEY || null;
}

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null },
  userAgent?: string
): Promise<void> {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime ?? null,
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await PushSubscription.deleteOne({ userId, endpoint });
}

async function sendToSubscriptions(subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>, payload: string): Promise<void> {
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
      } catch (err) {
        const statusCode = typeof err === 'object' && err && 'statusCode' in err ? (err as { statusCode?: number }).statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {});
          return;
        }
        logger.error('Web push delivery failed', { endpoint: sub.endpoint.slice(0, 80), statusCode, message: (err as Error).message });
      }
    })
  );
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url: string; tag?: string }): Promise<void> {
  if (!ensureConfigured()) return;
  const subscriptions = await PushSubscription.find({ userId }).select('endpoint keys').lean();
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, JSON.stringify(payload));
}

export async function sendPushForNotification(doc: NotificationDoc): Promise<void> {
  if (!ensureConfigured()) return;

  const payload = JSON.stringify({
    title: doc.senderName ? `${doc.senderName}: ${doc.title}` : doc.title,
    body: doc.message.slice(0, 180),
    url: doc.link || '/notifications',
    tag: `notification:${String(doc._id)}`,
  });

  let userIds: string[] = [];
  if (doc.userId) {
    userIds = [doc.userId];
  } else if (doc.recipientRole) {
    const filter: Record<string, unknown> = { isActive: true };
    if (doc.recipientRole !== 'all') filter.role = doc.recipientRole;
    const users = await User.find(filter).select('_id').lean();
    userIds = users.map((u) => String(u._id));
  }

  if (userIds.length === 0) return;
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).select('endpoint keys').lean();
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}