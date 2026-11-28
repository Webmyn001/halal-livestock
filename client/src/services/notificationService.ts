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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
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

  async delete(id: string): Promise<void> {
    await request<{ success: boolean }>({
      method: 'DELETE',
      url: `/notifications/in-app/${id}`,
    });
  },

  async adminSend(payload: SendNotificationPayload): Promise<{ sent: boolean; recipientsNotified: number; message: string }> {
    return request<{ sent: boolean; recipientsNotified: number; message: string }>({
      method: 'POST',
      url: '/notifications/admin/send',
      data: payload,
    });
  },

  async pushPublicKey(): Promise<{ enabled: boolean; publicKey: string | null }> {
    return request<{ enabled: boolean; publicKey: string | null }>({
      method: 'GET',
      url: '/notifications/push/public-key',
    });
  },

  async pushSubscribe(subscription: PushSubscriptionJSON): Promise<void> {
    await request<{ subscribed: boolean }>({
      method: 'POST',
      url: '/notifications/push/subscribe',
      data: subscription,
    });
  },

  async pushUnsubscribe(endpoint: string): Promise<void> {
    await request<{ subscribed: boolean }>({
      method: 'POST',
      url: '/notifications/push/unsubscribe',
      data: { endpoint },
    });
  },

  async enablePush(): Promise<'enabled' | 'unsupported' | 'denied' | 'unconfigured' | 'failed'> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const config = await this.pushPublicKey();
    if (!config.enabled || !config.publicKey) return 'unconfigured';

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'failed';
    await this.pushSubscribe(json);
    return 'enabled';
  },

  async pushStatus(): Promise<'unsupported' | 'unconfigured' | 'granted' | 'denied' | 'default' | 'subscribed'> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    const config = await this.pushPublicKey().catch(() => ({ enabled: false, publicKey: null }));
    if (!config.enabled) return 'unconfigured';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') return 'default';
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub ? 'subscribed' : 'granted';
  },
};
