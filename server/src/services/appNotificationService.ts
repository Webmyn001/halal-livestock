import { Notification, type NotificationDoc } from '../models/Notification';
import { logger } from '../utils/logger';
import { sendPushForNotification } from './pushService';

type NotificationInput = Parameters<typeof Notification.create>[0];

export async function createAppNotification(data: NotificationInput): Promise<NotificationDoc> {
  const doc = await Notification.create(data);
  void sendPushForNotification(doc).catch((err) => {
    logger.error('Push dispatch failed after notification create', { message: (err as Error).message });
  });
  return doc;
}