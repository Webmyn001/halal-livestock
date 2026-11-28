import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { RecentOrders } from '../../components/dashboard/RecentOrders';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orderService';
import type { Order } from '../../types';
import { formatNaira } from '../../utils/format';
import { ORDER_STATUS_LABELS, orderStatusStyle } from '../../utils/orderMeta';

function StatCard({ label, value, hint, to }: { label: string; value: string; hint: string; to: string }) {
  return (
    <Link to={to} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-sm text-ink-500">{hint}</p>
    </Link>
  );
}

export function BuyerDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    orderService
      .list({ scope: 'buyer', limit: 50 })
      .then((data) => { if (!cancelled) setOrders(data.orders); })
      .catch(() => { if (!cancelled) setError('Could not load your order summary.'); });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const all = orders ?? [];
    const active = all.filter((o) => !['completed', 'cancelled', 'refunded'].includes(o.status));
    const awaitingConfirmation = all.filter((o) => ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(o.status) && !o.disputeOpen);
    const paid = all.filter((o) => Boolean(o.paidAt));
    const spent = paid.reduce((sum, o) => sum + o.totalKobo, 0);
    return { active, awaitingConfirmation, paid, spent };
  }, [orders]);

  if (!user) return null;

  return (
    <div>
      <DashboardHeader
        eyebrow="Buyer dashboard"
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        caption="Browse verified livestock, chat with farmers before payment, track your orders, and confirm delivery only when you are satisfied."
        image="/images/buyer.jpg"
        alt="A trader selling at a market stall"
        aside={[
          { label: 'Account', value: user.isActive ? 'Active' : 'Suspended' },
          { label: 'Email', value: user.isEmailVerified ? 'Confirmed' : 'Not confirmed' },
          { label: 'Active orders', value: orders ? String(summary.active.length) : '—' },
        ]}
      />

      <div className="page-shell py-12 space-y-10">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <section>
          <h2 className="font-display text-xl font-semibold text-ink-900">Overview</h2>
          <p className="mt-1 text-sm text-ink-500">Your marketplace activity at a glance.</p>
          {!orders ? (
            <div className="mt-4 grid place-items-center py-8 text-brand-600"><Spinner className="size-7" /></div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Browse livestock" value="Marketplace" hint="Find verified halal livestock near you." to="/marketplace" />
              <StatCard label="Active orders" value={String(summary.active.length)} hint="Orders currently in progress." to="/orders" />
              <StatCard label="Confirm delivery" value={String(summary.awaitingConfirmation.length)} hint="Delivered orders waiting for your confirmation." to="/orders" />
              <StatCard label="Total spent" value={formatNaira(summary.spent)} hint={`You paid for ${summary.paid.length} order${summary.paid.length === 1 ? '' : 's'}.`} to="/orders" />
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { to: '/marketplace', title: 'Browse Livestock', body: 'Explore live and processed halal livestock from verified farms.', tone: 'bg-brand-50 ring-brand-200' },
            { to: '/orders', title: 'Track Orders', body: 'See payment, preparation, dispatch, and delivery confirmation status.', tone: 'bg-amber-50 ring-amber-200' },
            { to: '/notifications', title: 'Messages & Updates', body: 'Chat with farmers and receive order updates in one place.', tone: 'bg-sky-50 ring-sky-200' },
          ].map((card) => (
            <Link key={card.to} to={card.to} className={`rounded-card p-5 ring-1 transition hover:shadow-card ${card.tone}`}>
              <h3 className="font-display text-lg font-semibold text-ink-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{card.body}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-brand-700">Open →</span>
            </Link>
          ))}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-9">
            <RecentOrders perspective="buyer" />

            {summary.awaitingConfirmation.length > 0 ? (
              <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
                <h2 className="font-display text-lg font-semibold text-ink-900">Awaiting your confirmation</h2>
                <p className="mt-1 text-sm text-ink-500">Confirm receipt only when the livestock has arrived and matches your agreement.</p>
                <ul className="mt-4 space-y-3">
                  {summary.awaitingConfirmation.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{o.snapshot.title}</p>
                        <p className="text-xs text-ink-500">{o.orderCode} · {ORDER_STATUS_LABELS[o.status]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${orderStatusStyle(o.status)}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                        <Link to={`/orders/${o.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Review</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">What you spent</h2>
              <p className="mt-1 text-sm text-ink-500">See how much you paid for each livestock order. Delivery fees agreed outside the platform are not included.</p>
              {!orders ? (
                <div className="mt-4 grid place-items-center py-6 text-brand-600"><Spinner className="size-6" /></div>
              ) : summary.paid.length === 0 ? (
                <p className="mt-4 text-sm text-ink-500">No payments yet. When you pay for an order, it will appear here.</p>
              ) : (
                <ul className="mt-4 divide-y divide-stone-100">
                  {summary.paid.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{o.snapshot.title}</p>
                        <p className="text-xs text-ink-500">{o.orderCode} · {o.paidAt ? new Date(o.paidAt).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink-900">{formatNaira(o.totalKobo)}</p>
                        <p className="text-xs text-ink-500">Amount spent</p>
                        <Link to={`/orders/${o.id}`} className="text-xs font-medium text-brand-700 hover:underline">View order</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <VerificationCard />
            <ReportsCard />
          </div>

          <div className="space-y-6">
            <AccountPanel />
            <section className="rounded-card bg-brand-900 p-6 text-brand-100">
              <h2 className="font-display text-lg font-semibold text-white">Buying safely</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                <li>Chat with the farmer before paying to confirm availability, condition, and delivery arrangements.</li>
                <li>Your payment is held by HalalLivestock until you confirm receipt.</li>
                <li>Delivery fee, if any, is agreed directly with the farmer outside the platform.</li>
                <li>If there is a problem, report it from the order page before confirming receipt.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
