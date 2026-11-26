import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications, type TransactionNotice, type TransactionTone } from '../context/NotificationsContext';
import { formatDateTime } from '../utils/format';

const TONE_BADGE: Record<TransactionTone, string> = {
  info: 'bg-stone-100 text-stone-700 ring-stone-200',
  success: 'bg-brand-50 text-brand-800 ring-brand-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
};

function kindLabel(kind: TransactionNotice['kind']): string {
  if (kind === 'order') return 'Order update';
  if (kind === 'support') return 'Support message';
  return 'Update';
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
  return (
    <li className={`rounded-2xl border transition ${item.isRead ? 'border-stone-200 bg-white' : 'border-brand-200 bg-brand-50/30'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span className="mt-1.5 flex size-2.5 shrink-0" aria-hidden="true">
          <span className={`size-2.5 rounded-full ${item.isRead ? 'bg-stone-300' : 'bg-brand-600'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm ${item.isRead ? 'font-medium text-ink-800' : 'font-semibold text-ink-950'}`}>{item.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${TONE_BADGE[item.tone]}`}>
              {kindLabel(item.kind)}
            </span>
            {!item.isRead ? <span className="text-[11px] font-semibold text-brand-700">Unread</span> : <span className="text-[11px] text-ink-400">Read</span>}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {item.senderName ? `${item.senderName} · ` : ''}{item.createdAt ? formatDateTime(item.createdAt) : 'Just now'}
          </p>
          {!open ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">{item.body}</p> : null}
        </div>
        <span className="shrink-0 pt-0.5 text-xs font-medium text-brand-700">{open ? 'Close' : 'Open'}</span>
      </button>

      {open ? (
        <div className="border-t border-stone-200 px-4 py-4 sm:px-5 sm:pl-12">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{item.body}</p>
          {targetUrl ? (
            <Link to={targetUrl} className="mt-4 inline-flex rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800">
              {item.orderCode ? `Open order ${item.orderCode}` : 'View details'}
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
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        </div>
        {unread > 0 ? <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">{unread} unread</span> : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-5 rounded-xl bg-stone-50 px-4 py-4 text-sm text-ink-500 ring-1 ring-stone-200">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
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

  const orderNotices = useMemo(() => notices.filter((n) => n.kind === 'order'), [notices]);
  const supportNotices = useMemo(() => notices.filter((n) => n.kind !== 'order'), [notices]);

  function handleOpen(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) void markNoticeRead(next);
  }

  return (
    <div className="page-shell py-10 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            Read your order updates, admin messages, and support replies in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadNotices > 0 ? (
            <button type="button" onClick={() => void markAllRead()} className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50">
              Mark all read
            </button>
          ) : null}
          <button type="button" onClick={() => void refresh()} className="rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50">
            Refresh
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {user?.role !== 'admin' ? (
          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink-900">Messages</h2>
                <p className="mt-1 text-sm text-ink-500">Chat conversations with buyers, farmers, and order threads.</p>
              </div>
              {unreadMessages > 0 ? <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">{unreadMessages} unread</span> : null}
            </div>

            {loading && messages.length === 0 ? (
              <p className="mt-5 text-sm text-ink-500">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="mt-5 rounded-xl bg-stone-50 px-4 py-4 text-sm text-ink-500 ring-1 ring-stone-200">No conversations yet.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {messages.map((thread) => {
                  const isListing = thread.kind === 'listing' || (!thread.orderId && Boolean(thread.listingId));
                  const href = isListing ? `/marketplace/${thread.listingId}?thread=${thread.id}` : `/orders/${thread.orderId}`;
                  const title = isListing ? 'Listing inquiry' : `Order ${thread.orderCode ?? thread.orderId?.slice(-6) ?? ''}`;
                  return (
                    <li key={thread.id}>
                      <Link to={href} className={`block rounded-2xl border px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/30 ${thread.unread > 0 ? 'border-brand-200 bg-brand-50/20' : 'border-stone-200 bg-white'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${thread.unread > 0 ? 'bg-brand-600' : 'bg-stone-300'}`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`text-sm ${thread.unread > 0 ? 'font-semibold text-ink-950' : 'font-medium text-ink-800'}`}>{title}</p>
                              {thread.unread > 0 ? <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{thread.unread}</span> : <span className="text-[11px] text-ink-400">Read</span>}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-ink-600">{thread.lastMessageBody || 'Open conversation'}</p>
                            <p className="mt-1.5 text-xs text-ink-500">{formatDateTime(thread.lastMessageAt)}</p>
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
          description="Payment, delivery, confirmation, dispute, and payout updates."
          items={orderNotices}
          empty="No order updates yet."
          openId={openId}
          onOpen={handleOpen}
        />

        <NoticeSection
          title="Support & admin messages"
          description="Replies from Admin Halallivestock, customer messages, and important account notices."
          items={supportNotices}
          empty="No support messages yet."
          openId={openId}
          onOpen={handleOpen}
        />
      </div>
    </div>
  );
}
