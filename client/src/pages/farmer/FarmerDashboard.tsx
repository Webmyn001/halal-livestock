import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { MyListings } from '../../components/dashboard/MyListings';
import { RecentOrders } from '../../components/dashboard/RecentOrders';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orderService';
import { platformService } from '../../services/platformService';
import type { Order, PlatformInfo } from '../../types';
import { formatNaira } from '../../utils/format';
import { KYC_STATUS_LABELS, ORDER_STATUS_LABELS, orderStatusStyle } from '../../utils/orderMeta';

function StatCard({ label, value, hint, to }: { label: string; value: string; hint: string; to: string }) {
  return (
    <Link to={to} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-sm text-ink-500">{hint}</p>
    </Link>
  );
}

export function FarmerDashboardPage() {
  const { user } = useAuth();
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    platformService.info().then((d) => { if (!cancelled) setPlatform(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    orderService
      .list({ scope: 'farmer', limit: 50 })
      .then((d) => { if (!cancelled) setOrders(d.orders); })
      .catch(() => { if (!cancelled) setError('Could not load your order summary.'); });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const all = orders ?? [];
    const needsPrep = all.filter((o) => o.status === 'funded');
    const preparing = all.filter((o) => o.status === 'preparing');
    const inTransit = all.filter((o) => ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(o.status));
    const awaitingPayout = all.filter((o) => ['confirmed', 'awaiting_farmer_payout'].includes(o.status) || o.payoutStatus === 'awaiting_payout');
    const paidOut = all.filter((o) => o.status === 'completed' || o.payoutStatus === 'paid');
    const grossPaid = paidOut.reduce((s, o) => s + o.totalKobo, 0);
    return { needsPrep, preparing, inTransit, awaitingPayout, paidOut, grossPaid, all };
  }, [orders]);

  if (!user) return null;

  const profile = user.farmerProfile ?? null;
  const kycStatus = profile?.status ?? 'none';
  const verified = kycStatus === 'approved';
  const commission = platform ? `${(platform.commissionBps / 100).toFixed(2).replace(/\.00$/, '')}%` : '5%';

  return (
    <div>
      <DashboardHeader
        eyebrow="Farmer dashboard"
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        caption="Manage your livestock listings, prepare paid orders, dispatch deliveries, and track your payouts in one place."
        image="/images/farm.jpg"
        alt="Poultry farm"
        aside={[
          { label: 'Verification', value: KYC_STATUS_LABELS[kycStatus] },
          { label: 'Commission', value: commission },
          { label: 'Orders to act on', value: orders ? String(summary.needsPrep.length + summary.preparing.length) : '—' },
        ]}
      />

      <div className="page-shell py-12 space-y-10">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {!verified ? (
          <Alert tone="info" title="Verification required for payouts">
            You can post livestock now, but payouts are released only to verified farms.{' '}
            <Link to="/farmer/verify-farm" className="font-semibold underline">Complete farm verification</Link>.
          </Alert>
        ) : null}

        {summary.needsPrep.length > 0 ? (
          <section className="rounded-card bg-sky-50 p-6 ring-1 ring-sky-200">
            <h2 className="font-display text-lg font-semibold text-sky-950">Payment received! Set delivery time.</h2>
            <p className="mt-1 text-sm text-sky-800">Tell the buyer how many days it will take to deliver these paid orders.</p>
            <ul className="mt-4 space-y-3">
              {summary.needsPrep.slice(0, 5).map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-sky-100">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{o.orderCode} · {o.snapshot.title}</p>
                    <p className="text-xs text-ink-500">{o.quantity} {o.snapshot.unit} · {formatNaira(o.totalKobo)}</p>
                  </div>
                  <Link to={`/orders/${o.id}`}><Button size="sm">Set delivery time</Button></Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-xl font-semibold text-ink-900">Overview</h2>
          <p className="mt-1 text-sm text-ink-500">Your farm operations at a glance.</p>
          {!orders ? (
            <div className="mt-4 grid place-items-center py-8 text-brand-600"><Spinner className="size-7" /></div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Needs delivery time" value={String(summary.needsPrep.length)} hint="Paid orders waiting for your delivery time." to="/orders" />
              <StatCard label="On the way" value={String(summary.preparing.length + summary.inTransit.length)} hint="Orders being delivered to buyers." to="/orders" />
              <StatCard label="Awaiting payout" value={String(summary.awaitingPayout.length)} hint="Confirmed deliveries awaiting admin payout." to="/orders" />
              <StatCard label="Paid out" value={formatNaira(summary.grossPaid)} hint={`${summary.paidOut.length} completed order${summary.paidOut.length === 1 ? '' : 's'} (gross).`} to="/orders" />
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { to: '/farmer/post-livestock', title: 'My Livestock', body: 'Post new livestock, manage listings, and update availability.', tone: 'bg-brand-50 ring-brand-200' },
            { to: '/orders', title: 'Orders Received', body: 'See paid orders, set delivery days, and track buyer confirmation.', tone: 'bg-amber-50 ring-amber-200' },
            { to: '/notifications', title: 'Messages', body: 'Chat with buyers about livestock condition and delivery arrangements.', tone: 'bg-sky-50 ring-sky-200' },
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
            <RecentOrders perspective="farmer" />
            <MyListings />

            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Earnings & payouts</h2>
              <p className="mt-1 text-sm text-ink-500">Payouts are processed by admin after buyer confirmation. Commission is deducted per completed order.</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                  <dt className="text-xs text-ink-500">Awaiting payout</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink-900">{summary.awaitingPayout.length}</dd>
                </div>
                <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                  <dt className="text-xs text-ink-500">Completed payouts</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink-900">{summary.paidOut.length}</dd>
                </div>
                <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                  <dt className="text-xs text-ink-500">Platform commission</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink-900">{commission}</dd>
                </div>
              </dl>
              {summary.awaitingPayout.length > 0 ? (
                <ul className="mt-4 divide-y divide-stone-100">
                  {summary.awaitingPayout.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{o.orderCode} · {o.snapshot.title}</p>
                        <p className="text-xs text-ink-500">{ORDER_STATUS_LABELS[o.status]}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${orderStatusStyle(o.status)}`}>{o.payoutStatus === 'paid' ? 'Paid' : 'Awaiting payout'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-500">No payouts waiting right now. Confirmed deliveries will appear here until admin releases payment.</p>
              )}
            </section>

            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Reviews</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Buyer reviews will appear here when the review system is enabled. For now, focus on accurate listings, timely preparation, and clear delivery communication.
              </p>
            </section>

            <VerificationCard />
            <ReportsCard />
          </div>

          <div className="space-y-6">
            <AccountPanel />
            <section className="rounded-card bg-brand-900 p-6 text-brand-100">
              <h2 className="font-display text-lg font-semibold text-white">Farm operations</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                <li>When payment is received, set how many days delivery will take.</li>
                <li>Agree delivery fee and arrangements with the buyer in chat; delivery fee is outside the platform.</li>
                <li>After the buyer confirms receipt, admin releases your payout.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
