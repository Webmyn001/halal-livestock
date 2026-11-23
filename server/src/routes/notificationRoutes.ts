import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  listNotifications,
  markNotificationsRead,
  adminSendNotification,
} from '../controllers/notificationController';

export const notificationRouter = Router();

notificationRouter.use(verifyToken);

notificationRouter.get('/in-app', listNotifications);
notificationRouter.post('/in-app/read', markNotificationsRead);
notificationRouter.post('/admin/send', requireRole('admin'), adminSendNotification);
