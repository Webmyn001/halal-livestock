import { request } from './apiClient';
import type { AppNotification } from '../types';

export interface SendNotificationPayload {
  target: 'user' | 'role' | 'all';
  userId?: string;
  role?: 'buyer' | 'farmer' | 'admin' | 'all';
  title: string;
  message: string;
  tone?: 'info' | 'warning' | 'success';
  link?: string;
}

export const notificationService = {
  async list(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    return request<{ notifications: AppNotification[]; unreadCount: number }>({
      method: 'GET',
      url: '/notifications/in-app',
    });
  },

  async markRead(id?: string): Promise<void> {
    await request<{ success: boolean }>({
      method: 'POST',
      url: '/notifications/in-app/read',
      data: { id },
    });
  },

  async adminSend(payload: SendNotificationPayload): Promise<{ sent: boolean; recipientsNotified: number; message: string }> {
    return request<{ sent: boolean; recipientsNotified: number; message: string }>({
      method: 'POST',
      url: '/notifications/admin/send',
      data: payload,
    });
  },
};
