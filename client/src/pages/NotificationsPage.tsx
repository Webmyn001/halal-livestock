import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications, type TransactionNotice } from '../context/NotificationsContext';
import { notificationService } from '../services/notificationService';
import { formatDateTime } from '../utils/format';

function noticeState(item: TransactionNotice): { label: string; className: string } {
  if (!item.isRead) return { label: 'Unread', className: 'bg-brand-600 text-white' };
  return { label: 'Read', className: 'bg-stone-200 text-stone-700' };
}

function actionForNotice(item: TransactionNotice): { label: string; hint: string } | null {
  const text = `${item.title} ${item.body}`.toLowerCase();
  if (text.includes('confirm receipt') || text.includes('confirm when received') || text.includes('awaiting buyer confirmation')) {
    return { label: item.orderCode ? `Open order ${item.orderCode} to confirm` : 'Confirm delivery', hint: 'Action needed: confirm you received the livestock, or report a problem.' };
  }
  if (text.includes('set delivery time') || text.includes('set how many days') || text.includes('start preparing')) {
    return { label: item.orderCode ? `Open order ${item.orderCode} to set delivery` : 'Set delivery time', hint: 'Action needed: tell the buyer how many days delivery will take.' };
  }
  if (text.includes('awaiting admin payout') || text.includes('review and pay')) {
    return { label: item.orderCode ? `Review payout for ${item.orderCode}` : 'Review payout', hint: 'Action needed: review and process the farmer payout.' };
  }
  if (text.includes('dispute') || text.includes('report a problem')) {
    return { label: item.orderCode ? `Open order ${item.orderCode}` : 'View details', hint: 'Review this update and take action if needed.' };
  }
  if (item.link || item.orderId) return { label: item.orderCode ? `Open order ${item.orderCode}` : 'View details', hint: '' };
  return null;
}

function NoticeRow({
  item,
  open,
  onToggle,
}: {
  item: TransactionNotice;
  open: boolean;
  onToggle: () => void;
}) {
  const targetUrl = item.link || (item.orderId ? `/orders/${item.orderId}` : null);
  const action = actionForNotice(item);
  const state = noticeState(item);

  return (
    <li className={`border-b border-stone-200 last:border-b-0 ${!item.isRead ? 'bg-brand-50/40' : 'bg-white'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-stone-50 sm:px-5"
      >
        <span className="mt-2 flex size-2 shrink-0" aria-hidden="true">
          <span className={`size-2 rounded-full ${item.isRead ? 'bg-transparent' : 'bg-brand-600'}`} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate text-sm ${item.isRead ? 'font-medium text-ink-800' : 'font-semibold text-ink-950'}`}>
                {item.senderName || (item.kind === 'support' ? 'Support' : item.kind === 'order' ? 'Order update' : 'Update')}
              </p>
              <p className={`truncate text-sm ${item.isRead ? 'text-ink-700' : 'font-medium text-ink-900'}`}>{item.title}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-ink-500">{item.createdAt ? formatDateTime(item.createdAt) : 'Just now'}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.className}`}>{state.label}</span>
            </div>
          </div>
          {!open ? <p className="mt-1 truncate text-sm text-ink-500">{item.body}</p> : null}
        </div>
      </button>

      {open ? (
        <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-4 sm:px-5 sm:pl-11">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span className="rounded bg-white px-2 py-1 ring-1 ring-stone-200">{item.kind === 'order' ? 'Order' : item.kind === 'support' ? 'Support' : 'Update'}</span>
            <span className="rounded bg-white px-2 py-1 ring-1 ring-stone-200">{state.label}</span>
            {item.senderName ? <span>From: {item.senderName}</span> : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{item.body}</p>

          {action?.hint ? (
            <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              <span className="font-semibold">What to do: </span>{action.hint}
            </div>
          ) : null}

          {targetUrl && action ? (
            <Link to={targetUrl} className="mt-4 inline-flex rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800">
              {action.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function NoticeSection({
  title,
  description,
  items,
  empty,
  openId,
  onOpen,
}: {
  title: string;
  description: string;
  items: TransactionNotice[];
  empty: string;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const unread = items.filter((i) => !i.isRead).length;
  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-stone-200 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-500">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {unread > 0 ? <span className="rounded bg-brand-100 px-2 py-1 font-semibold text-brand-800">{unread} unread</span> : <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">All read</span>}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-500 sm:px-5">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => <NoticeRow key={item.id} item={item} open={openId === item.id} onToggle={() => onOpen(item.id)} />)}
        </ul>
      )}
    </section>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { messages, notices, unreadMessages, unreadNotices, loading, refresh, markNoticeRead, markAllRead } = useNotifications();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'loading' | 'unsupported' | 'unconfigured' | 'granted' | 'denied' | 'default' | 'subscribed'>('loading');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let active = true;
    notificationService.pushStatus().then((s) => { if (active) setPushStatus(s); }).catch(() => { if (active) setPushStatus('unsupported'); });
    return () => { active = false; };
  }, []);

  const orderNotices = useMemo(() => notices.filter((n) => n.kind === 'order'), [notices]);
  const supportNotices = useMemo(() => notices.filter((n) => n.kind !== 'order'), [notices]);

  function handleOpen(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) void markNoticeRead(next);
  }

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      const result = await notificationService.enablePush();
      if (result === 'enabled') setPushStatus('subscribed');
      else if (result === 'denied') setPushStatus('denied');
      else if (result === 'unconfigured') setPushStatus('unconfigured');
      else if (result === 'unsupported') setPushStatus('unsupported');
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Inbox</p>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="mt-1 text-sm text-ink-500">Messages, order updates, and actions you need to take.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadNotices > 0 ? (
            <button type="button" onClick={() => void markAllRead()} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50">
              Mark all read
            </button>
          ) : null}
          <button type="button" onClick={() => void refresh()} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50">
            Refresh
          </button>
        </div>
      </header>

      {pushStatus === 'default' || pushStatus === 'granted' ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-200">
          <div>
            <p className="text-sm font-semibold text-brand-900">Turn on device notifications</p>
            <p className="text-sm text-brand-800">Get alerts for messages and order updates.</p>
          </div>
          <button type="button" onClick={() => void handleEnablePush()} disabled={pushBusy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {pushBusy ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      ) : null}
      {pushStatus === 'subscribed' ? (
        <div className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">Device notifications are on.</div>
      ) : null}
      {pushStatus === 'denied' ? (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Notifications are blocked in browser settings. Allow them to receive alerts.</div>
      ) : null}

      <div className="mt-6 space-y-4">
        {user?.role !== 'admin' ? (
          <section className="overflow-hidden rounded-xl bg-white ring-1 ring-stone-200 shadow-card">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Messages</h2>
                <p className="mt-0.5 text-sm text-ink-500">Chats with buyers and farmers.</p>
              </div>
              {unreadMessages > 0 ? <span className="rounded bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-800">{unreadMessages} unread</span> : <span className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600">All read</span>}
            </div>

            {loading && messages.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500 sm:px-5">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500 sm:px-5">No conversations yet.</p>
            ) : (
              <ul>
                {messages.map((thread) => {
                  const isListing = thread.kind === 'listing' || (!thread.orderId && Boolean(thread.listingId));
                  const href = isListing ? `/marketplace/${thread.listingId}?thread=${thread.id}` : `/orders/${thread.orderId}`;
                  const title = isListing ? 'Listing inquiry' : `Order ${thread.orderCode ?? thread.orderId?.slice(-6) ?? ''}`;
                  return (
                    <li key={thread.id} className={`border-b border-stone-200 last:border-b-0 ${thread.unread > 0 ? 'bg-brand-50/40' : 'bg-white'}`}>
                      <Link to={href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50 sm:px-5">
                        <span className={`mt-2 size-2 shrink-0 rounded-full ${thread.unread > 0 ? 'bg-brand-600' : 'bg-transparent'}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`truncate text-sm ${thread.unread > 0 ? 'font-semibold text-ink-950' : 'font-medium text-ink-800'}`}>{title}</p>
                              <p className="truncate text-sm text-ink-600">{thread.lastMessageBody || 'Open conversation'}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[11px] text-ink-500">{formatDateTime(thread.lastMessageAt)}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${thread.unread > 0 ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-700'}`}>
                                {thread.unread > 0 ? 'Unread' : 'Read'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <NoticeSection
          title="Order updates"
          description="Payment, delivery, confirmation, and payout updates."
          items={orderNotices}
          empty="No order updates yet."
          openId={openId}
          onOpen={handleOpen}
        />

        <NoticeSection
          title="Support & admin messages"
          description="Replies from Admin Halallivestock and customer messages."
          items={supportNotices}
          empty="No support messages yet."
          openId={openId}
          onOpen={handleOpen}
        />
      </div>
    </div>
  );
}
