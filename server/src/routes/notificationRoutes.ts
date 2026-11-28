import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  listNotifications,
  markNotificationsRead,
  deleteNotification,
  adminSendNotification,
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
} from '../controllers/notificationController';

export const notificationRouter = Router();

notificationRouter.use(verifyToken);

notificationRouter.get('/in-app', listNotifications);
notificationRouter.post('/in-app/read', markNotificationsRead);
notificationRouter.delete('/in-app/:id', deleteNotification);
notificationRouter.get('/push/public-key', getPushPublicKey);
notificationRouter.post('/push/subscribe', subscribePush);
notificationRouter.post('/push/unsubscribe', unsubscribePush);
notificationRouter.post('/admin/send', requireRole('admin'), adminSendNotification);
