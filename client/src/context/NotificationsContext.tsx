import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';
import type { Order, ThreadSummary } from '../types';

export type TransactionTone = 'info' | 'success' | 'warning';

export interface TransactionNotice {
  id: string;
  orderId?: string;
  orderCode?: string;
  title: string;
  body: string;
  tone: TransactionTone;
  link?: string;
  createdAt?: string;
}

interface NotificationsContextValue {
  messages: ThreadSummary[];
  notices: TransactionNotice[];
  unreadMessages: number;
  unreadNotices: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markNoticesSeen: () => void;
}

const MESSAGES_CHANGED = 'halal:messages-changed';
const ORDERS_CHANGED = 'halal:orders-changed';
const REFRESH_MS = 45_000;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function notice(
  order: Order,
  key: string,
  title: string,
  body: string,
  tone: TransactionTone
): TransactionNotice {
  return { id: `${order.id}:${key}`, orderId: order.id, orderCode: order.orderCode, title, body, tone };
}

/** Turns the current state of an order into a short, readable in-app message. */
function noticesForOrder(order: Order, role: 'buyer' | 'farmer'): TransactionNotice[] {
  const out: TransactionNotice[] = [];

  if (order.disputeOpen) {
    out.push(
      notice(order, 'case', 'A case is open', `The admin is reviewing order ${order.orderCode}. Your money stays safe while it is open.`, 'warning')
    );
  }

  if (order.paymentState === 'refunded') {
    out.push(notice(order, 'refunded', 'Payment returned', `Order ${order.orderCode} was refunded.`, 'info'));
  } else if (order.status === 'awaiting_payment' && role === 'buyer') {
    out.push(notice(order, 'awaiting', 'Waiting for payment', `Order ${order.orderCode} is reserved. Finish payment to hold the money safely.`, 'info'));
  } else if (order.status === 'funded') {
    out.push(
      role === 'farmer'
        ? notice(order, 'funded', 'New paid order', `${order.orderCode} is paid and held. Accept it so the buyer knows you are preparing.`, 'success')
        : notice(order, 'funded', 'Payment received', `${order.orderCode} is paid. Your money is held safely until you confirm receipt.`, 'success')
    );
  } else if (order.status === 'preparing') {
    out.push(
      role === 'farmer'
        ? notice(order, 'preparing', 'Get the order ready', `You accepted ${order.orderCode}. Agree delivery details with the buyer in chat.`, 'info')
        : notice(order, 'preparing', 'Farmer accepted', `The farmer is preparing ${order.orderCode}. Use chat to agree delivery.`, 'info')
    );
  } else if (order.status === 'out_for_delivery' || order.status === 'awaiting_buyer_confirmation') {
    out.push(
      role === 'buyer'
        ? notice(order, 'delivery', 'Livestock in transit', `${order.orderCode} is on the way. Confirm receipt when it arrives, or report a problem.`, 'info')
        : notice(order, 'delivery', 'Awaiting buyer confirmation', `${order.orderCode} has been dispatched. Waiting for buyer confirmation.`, 'info')
    );
  } else if (order.status === 'delivery_overdue') {
    out.push(
      role === 'buyer'
        ? notice(order, 'overdue', 'Delivery overdue', `${order.orderCode} is past its expected delivery time. Confirm receipt or report a problem.`, 'warning')
        : notice(order, 'overdue', 'Delivery overdue', `${order.orderCode} is overdue. Check in with the buyer through chat.`, 'warning')
    );
  } else if (order.status === 'confirmed' || order.status === 'awaiting_farmer_payout') {
    out.push(
      role === 'farmer'
        ? notice(order, 'confirmed', 'Delivery confirmed', `${order.orderCode} was confirmed by the buyer. Payout is awaiting admin processing.`, 'success')
        : notice(order, 'confirmed', 'Delivery confirmed', `${order.orderCode} is confirmed. Farmer payout is processed separately by admin.`, 'success')
    );
  } else if (order.status === 'completed') {
    out.push(notice(order, 'completed', 'Order complete', `${order.orderCode} is complete${role === 'farmer' ? ' and your payout has been released' : ''}.`, 'success'));
  } else if (order.status === 'disputed') {
    out.push(notice(order, 'disputed', 'Dispute under review', `${order.orderCode} has an open dispute. Admin will review and resolve it.`, 'warning'));
  } else if (order.status === 'cancelled') {
    out.push(notice(order, 'cancelled', 'Order cancelled', `${order.orderCode} was cancelled.`, 'info'));
  }

  return out;
}

function readSeen(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const seenKey = user ? `halal.notifications.seen.${user.id}` : '';

  const [messages, setMessages] = useState<ThreadSummary[]>([]);
  const [notices, setNotices] = useState<TransactionNotice[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [serverUnreadNotices, setServerUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeenIds(seenKey ? readSeen(seenKey) : []);
  }, [seenKey]);

  const refresh = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setNotices([]);
      return;
    }

    setLoading(true);
    const promises: [
      Promise<ThreadSummary[] | null>,
      Promise<{ orders: Order[] } | null>,
      Promise<{ notifications: any[]; unreadCount: number } | null>
    ] = [
      user.role === 'buyer' || user.role === 'farmer' ? chatService.threads().catch(() => null) : Promise.resolve(null),
      user.role === 'buyer' || user.role === 'farmer' ? orderService.list({ limit: 50 }).catch(() => null) : Promise.resolve(null),
      notificationService.list().catch(() => null),
    ];

    const [threads, orderData, inApp] = await Promise.all(promises);

    if (threads) setMessages(threads);

    const mergedNotices: TransactionNotice[] = [];

    // Add server in-app notifications (admin broadcasts, user notifications, contact form alerts for admin)
    if (inApp && inApp.notifications) {
      setServerUnreadNotices(inApp.unreadCount);
      inApp.notifications.forEach((item: any) => {
        mergedNotices.push({
          id: `app:${item.id}`,
          title: item.title,
          body: item.message,
          tone: item.tone || 'info',
          link: item.link,
          createdAt: item.createdAt,
        });
      });
    }

    // Add order state notices for buyers and farmers (fallback when no server notice exists for that order)
    if (orderData && (user.role === 'buyer' || user.role === 'farmer')) {
      const serverOrderLinks = new Set(mergedNotices.map((n) => n.link).filter(Boolean));
      const orderNotices = orderData.orders
        .flatMap((order) => noticesForOrder(order, user.role as 'buyer' | 'farmer'))
        .filter((n) => !n.link || !serverOrderLinks.has(n.link));
      mergedNotices.push(...orderNotices);
    }

    setNotices(mergedNotices);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setNotices([]);
      return;
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onFocus = () => void refresh();
    const onMessages = () => void refresh();
    const onOrders = () => void refresh();

    window.addEventListener('focus', onFocus);
    window.addEventListener(MESSAGES_CHANGED, onMessages);
    window.addEventListener(ORDERS_CHANGED, onOrders);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(MESSAGES_CHANGED, onMessages);
      window.removeEventListener(ORDERS_CHANGED, onOrders);
    };
  }, [user, refresh]);

  const markNoticesSeen = useCallback(() => {
    if (!seenKey || notices.length === 0) return;
    notificationService.markRead().catch(() => {});
    setServerUnreadNotices(0);
    setSeenIds((current) => {
      const merged = Array.from(new Set([...current, ...notices.map((item) => item.id)]));
      if (merged.length === current.length && merged.every((id, index) => id === current[index])) return current;
      localStorage.setItem(seenKey, JSON.stringify(merged));
      return merged;
    });
  }, [notices, seenKey]);

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadMessages = messages.reduce((total, thread) => total + thread.unread, 0);
    const clientUnread = notices.filter((item) => !seenIds.includes(item.id)).length;
    const unreadNotices = Math.max(clientUnread, serverUnreadNotices);
    return { messages, notices, unreadMessages, unreadNotices, loading, refresh, markNoticesSeen };
  }, [messages, notices, seenIds, serverUnreadNotices, loading, refresh, markNoticesSeen]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}
