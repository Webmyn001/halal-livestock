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
import type { Order, ThreadSummary } from '../types';

export type TransactionTone = 'info' | 'success' | 'warning';

export interface TransactionNotice {
  id: string;
  orderId: string;
  orderCode: string;
  title: string;
  body: string;
  tone: TransactionTone;
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
  } else if (order.status === 'out_for_delivery') {
    out.push(notice(order, 'delivery', 'Delivery being arranged', `Chat about ${order.orderCode} to agree the handover time and place.`, 'info'));
  } else if (order.status === 'confirmed') {
    out.push(notice(order, 'confirmed', 'Receipt confirmed', `You confirmed ${order.orderCode}. The admin will release the payout to the farm.`, 'success'));
  } else if (order.status === 'completed') {
    out.push(notice(order, 'completed', 'Order complete', `${order.orderCode} is complete and the farmer has been paid.`, 'success'));
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
  const role = user?.role === 'buyer' || user?.role === 'farmer' ? user.role : null;
  const seenKey = user ? `halal.notifications.seen.${user.id}` : '';

  const [messages, setMessages] = useState<ThreadSummary[]>([]);
  const [notices, setNotices] = useState<TransactionNotice[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeenIds(seenKey ? readSeen(seenKey) : []);
  }, [seenKey]);

  const refresh = useCallback(async () => {
    if (!role || !user) {
      setMessages([]);
      setNotices([]);
      return;
    }

    setLoading(true);
    const [threadResult, orderResult] = await Promise.allSettled([
      chatService.threads(),
      orderService.list({ limit: 50 }),
    ]);

    if (threadResult.status === 'fulfilled') setMessages(threadResult.value);
    if (orderResult.status === 'fulfilled') {
      setNotices(orderResult.value.orders.flatMap((order) => noticesForOrder(order, role)));
    }
    setLoading(false);
  }, [role, user]);

  useEffect(() => {
    if (!role) {
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
  }, [role, refresh]);

  const markNoticesSeen = useCallback(() => {
    if (!seenKey || notices.length === 0) return;
    setSeenIds((current) => {
      const merged = Array.from(new Set([...current, ...notices.map((item) => item.id)]));
      if (merged.length === current.length && merged.every((id, index) => id === current[index])) return current;
      localStorage.setItem(seenKey, JSON.stringify(merged));
      return merged;
    });
  }, [notices, seenKey]);

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadMessages = messages.reduce((total, thread) => total + thread.unread, 0);
    const unreadNotices = notices.filter((item) => !seenIds.includes(item.id)).length;
    return { messages, notices, unreadMessages, unreadNotices, loading, refresh, markNoticesSeen };
  }, [messages, notices, seenIds, loading, refresh, markNoticesSeen]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}
