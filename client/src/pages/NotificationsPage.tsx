import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/common/Alert';
import { useNotifications, type TransactionTone } from '../context/NotificationsContext';
import { formatDateTime } from '../utils/format';

const TONE_STYLES: Record<TransactionTone, string> = {
  info: 'border-stone-200 bg-stone-50 text-ink-700',
  success: 'border-brand-200 bg-brand-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export function NotificationsPage() {
  const { messages, notices, unreadMessages, loading, refresh, markNoticesSeen } = useNotifications();

  // Opening this page counts as seeing the transaction messages. Chat unread counts clear when the
  // thread itself is opened, because that is where the other person's words are actually read.
  useEffect(() => {
    if (!loading) markNoticesSeen();
  }, [loading, notices, markNoticesSeen]);

  return (
    <div className="page-shell py-10 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            New messages and what is happening with your orders, in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50"
        >
          Refresh
        </button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
        <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-ink-900">Messages</h2>
            {unreadMessages > 0 ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                {unreadMessages} unread
              </span>
            ) : null}
          </div>

          {loading && messages.length === 0 ? (
            <p className="mt-5 text-sm text-ink-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-ink-500">
              No conversations yet. Use listing chat or order chat to discuss livestock details and delivery arrangements.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {messages.map((thread) => {
                const isListing = thread.kind === 'listing' || (!thread.orderId && Boolean(thread.listingId));
                const href = isListing
                  ? `/marketplace/${thread.listingId}?thread=${thread.id}`
                  : `/orders/${thread.orderId}`;
                const title = isListing ? 'Listing inquiry' : `Order ${thread.orderCode ?? thread.orderId?.slice(-6) ?? ''}`;
                return (
                  <li key={thread.id}>
                    <Link
                      to={href}
                      className="block rounded-xl border border-stone-200 px-4 py-3.5 transition hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-ink-900">{title}</p>
                        {thread.unread > 0 ? (
                          <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            {thread.unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">{thread.lastMessageBody || 'Open conversation'}</p>
                      <p className="mt-1.5 text-[11px] text-ink-500">{formatDateTime(thread.lastMessageAt)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
          <h2 className="font-display text-base font-semibold text-ink-900">Updates & Notifications</h2>
          <p className="mt-1 text-xs text-ink-500">Order updates, admin messages, and contact alerts.</p>

          {loading && notices.length === 0 ? (
            <p className="mt-5 text-sm text-ink-500">Loading updates…</p>
          ) : notices.length === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-ink-500">No updates or notifications yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {notices.map((item) => {
                const targetUrl = item.link || (item.orderId ? `/orders/${item.orderId}` : null);
                const content = (
                  <div className={`rounded-xl border px-4 py-3.5 transition hover:brightness-[0.98] ${TONE_STYLES[item.tone]}`}>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{item.body}</p>
                    {item.orderCode ? (
                      <p className="mt-2 text-[11px] font-medium underline">Open order {item.orderCode}</p>
                    ) : item.link ? (
                      <p className="mt-2 text-[11px] font-medium underline">View details →</p>
                    ) : null}
                  </div>
                );

                return (
                  <li key={item.id}>
                    {targetUrl ? (
                      <Link to={targetUrl} className="block">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8">
        <Alert tone="info" title="How to keep track">
          Open an order any time to see its progress, chat with the other side, and open a case if something goes wrong.
          Every change is also listed here.
        </Alert>
      </div>
    </div>
  );
}
