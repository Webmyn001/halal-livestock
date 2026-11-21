import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaArrowLeftLong, FaLocationDot, FaTruck, FaWallet } from 'react-icons/fa6';
import { Alert } from '../components/common/Alert';
import { Button, Spinner } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ChatPanel } from '../components/order/ChatPanel';
import { DisputePanel } from '../components/order/DisputePanel';
import { StatusTimeline } from '../components/order/StatusTimeline';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { deliveryService } from '../services/deliveryService';
import type { Driver } from '../services/deliveryService';
import { orderService } from '../services/orderService';
import type { Order } from '../types';
import { formatDateTime, formatNaira } from '../utils/format';
import { LISTING_TYPE_LABELS, SPECIES_LABELS, UNIT_LABELS } from '../utils/listingMeta';
import { ORDER_STATUS_LABELS, orderStatusStyle } from '../utils/orderMeta';

const DISPUTE_OPENABLE: Order['status'][] = ['funded', 'preparing', 'out_for_delivery', 'confirmed'];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState<'pay' | 'check' | 'accept' | 'cancel' | 'dispatch' | 'code' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [code, setCode] = useState('');
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [driverId, setDriverId] = useState('');

  const load = useCallback(() => {
    setOrder(null);
    setError(null);
    orderService
      .get(id)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not open that order', 'UNKNOWN'));
      });
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    deliveryService
      .drivers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, [user?.role]);

  async function run(action: 'pay' | 'check' | 'accept' | 'cancel' | 'dispatch' | 'code', task: () => Promise<Order>) {
    setBusy(action);
    setProblem('');
    try {
      setOrder(await task());
      if (action === 'cancel') setIsCancelOpen(false);
      if (action === 'code') setCode('');
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That action did not go through.');
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="page-shell py-16">
        <div className="mx-auto max-w-lg space-y-6">
          <Alert tone="error" title="That order is not here">
            {error.message}
          </Alert>
          <Link to="/orders">
            <Button variant="secondary">
              <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
              Back to my orders
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!order || !user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  const isBuyer = user.role === 'buyer' && order.isBuyer;
  const isFarmer = user.role === 'farmer' && order.isFarmer;
  const isDriver = user.role === 'driver';
  const isAdmin = user.role === 'admin';
  const canPay = isBuyer && order.status === 'awaiting_payment';
  const canCancel = (isBuyer || isAdmin) && ['awaiting_payment', 'funded', 'preparing'].includes(order.status);
  const partyChat = isBuyer || isFarmer;
  const unit = order.quantity === 1 ? UNIT_LABELS[order.snapshot.unit] : `${UNIT_LABELS[order.snapshot.unit]}s`;

  async function handlePay() {
    setBusy('pay');
    setProblem('');
    try {
      const checkout = await orderService.startPayment(id);
      // Paystack sends the buyer off site; the mock provider returns a page on this same app.
      window.location.assign(checkout.authorizationUrl);
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'The payment page did not open.');
      setBusy(null);
    }
  }

  async function handleDispatch(event: FormEvent) {
    event.preventDefault();
    if (!driverId) return;
    await run('dispatch', () => deliveryService.dispatch(id, driverId));
  }

  async function handleCode(event: FormEvent) {
    event.preventDefault();
    await run('code', () => deliveryService.submitCode(id, code));
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <Link
        to={isAdmin || isDriver ? (isAdmin ? '/admin/dashboard' : '/deliveries') : '/orders'}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-brand-700"
      >
        <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
        {isAdmin ? 'Admin console' : isDriver ? 'My deliveries' : 'My orders'}
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Order {order.orderCode}</p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold text-ink-900 sm:text-3xl">{order.snapshot.title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Placed {formatDateTime(order.createdAt)} · {SPECIES_LABELS[order.snapshot.species]} ·{' '}
            {LISTING_TYPE_LABELS[order.snapshot.listingType]}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${orderStatusStyle(order.status)}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </header>

      {problem ? (
        <div className="mt-5">
          <Alert tone="error">{problem}</Alert>
        </div>
      ) : null}

      <div className="mt-7 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="min-w-0 space-y-8">
          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink-900">What happens next</h2>
            <div className="mt-5">
              <StatusTimeline order={order} />
            </div>
          </section>

          {order.status === 'out_for_delivery' && order.confirmationCode ? (
            <section className="rounded-card bg-brand-900 p-6 text-brand-100 sm:p-7">
              <h2 className="font-display text-lg font-semibold text-white">Your collection code</h2>
              <p className="mt-2 text-sm leading-relaxed">
                Read this code to the driver after you have counted and checked the animals. The driver cannot see it, and
                your money is only released after you give it.
              </p>
              <p className="mt-5 text-balance text-4xl font-bold tracking-[0.28em] text-gold-300 sm:text-5xl">
                {order.confirmationCode}
              </p>
            </section>
          ) : null}

          {isDriver && order.canEnterCode ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Hand over the animals</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Ask the buyer for the six digit code once they are happy with what arrived. Entering it closes the
                delivery and starts the payout to the farm.
              </p>
              <form onSubmit={handleCode} className="mt-5 space-y-4">
                <Input
                  label="Code from the buyer"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="max-w-[14rem] font-mono tracking-[0.3em]"
                />
                <Button type="submit" isLoading={busy === 'code'} disabled={code.length !== 6}>
                  Confirm the handover
                </Button>
              </form>
            </section>
          ) : null}

          {order.delivery ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">
                {isBuyer ? 'Where the animals are going' : 'Delivery details'}
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Field label="Receives them" value={order.delivery.contactName} />
                <Field label="Phone the driver calls" value={order.delivery.contactPhone} />
                <Field
                  label="Address"
                  value={`${order.delivery.address}, ${order.delivery.town}, ${order.delivery.state}`}
                />
                {order.delivery.wantedDate ? (
                  <Field label="Wanted day" value={formatDateTime(order.delivery.wantedDate)} />
                ) : null}
              </dl>
              {isFarmer && order.status === 'funded' ? (
                <p className="mt-4 flex gap-2 rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-500 ring-1 ring-inset ring-stone-200">
                  <FaLocationDot aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Call the buyer before you set out. A driver arranged by the platform carries the code, and you get paid
                  after the handover.
                </p>
              ) : null}
            </section>
          ) : null}

          {partyChat ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Messages on this order</h2>
              <p className="mt-1.5 mb-5 text-sm leading-relaxed text-ink-500">
                {order.buyer?.fullName ?? 'Buyer'} and {order.farmer?.fullName ?? 'the farm'} only. An admin reading a
                case sees the whole thread.
              </p>
              <ChatPanel orderId={order.id} myRole={isBuyer ? 'buyer' : 'farmer'} />
            </section>
          ) : null}

          {partyChat ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Something wrong</h2>
              <div className="mt-4">
                <DisputePanel
                  orderId={order.id}
                  orderCode={order.orderCode}
                  totalKobo={order.totalKobo}
                  canOpen={DISPUTE_OPENABLE.includes(order.status)}
                />
              </div>
            </section>
          ) : null}

          {isAdmin && (order.status === 'funded' || order.status === 'preparing') ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Send a driver</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Choosing a driver generates the collection code and emails it to the buyer. The driver never sees it.
              </p>
              <form onSubmit={handleDispatch} className="mt-5 space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-ink-700">Driver</span>
                  <select
                    value={driverId}
                    onChange={(event) => setDriverId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
                  >
                    <option value="">Choose a driver</option>
                    {(drivers ?? []).map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.fullName} · {driver.phoneNumber}
                      </option>
                    ))}
                  </select>
                </label>
                {drivers && drivers.length === 0 ? (
                  <p className="text-xs leading-relaxed text-ink-500">
                    No active driver account yet. Create one with the seed script using the driver role.
                  </p>
                ) : null}
                <Button type="submit" isLoading={busy === 'dispatch'} disabled={!driverId}>
                  Dispatch
                </Button>
              </form>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">Money on this order</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-500">
                  {formatNaira(order.snapshot.priceKobo)} × {order.quantity} {unit}
                </dt>
                <dd className="font-semibold text-ink-900">{formatNaira(order.totalKobo)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-500">Payment</dt>
                <dd className="font-semibold text-ink-900">
                  {order.status === 'completed'
                    ? 'Paid to the farmer'
                    : order.paymentState === 'held'
                      ? 'Held by the platform'
                      : order.paymentState === 'refunded'
                        ? 'Returned to the buyer'
                        : 'Not paid yet'}
                </dd>
              </div>
              {order.paidAt ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-500">Received</dt>
                  <dd className="text-ink-900">{formatDateTime(order.paidAt)}</dd>
                </div>
              ) : null}
            </dl>

            {order.paymentReference && (isBuyer || isAdmin) ? (
              <p className="mt-3 break-all text-[11px] text-ink-500">Reference {order.paymentReference}</p>
            ) : null}

            {order.note ? (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-700 ring-1 ring-inset ring-stone-200">
                {order.note}
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              {canPay ? (
                <>
                  <Button size="lg" className="w-full" isLoading={busy === 'pay'} onClick={handlePay}>
                    <FaWallet aria-hidden="true" className="size-4" />
                    Pay and hold the money
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    isLoading={busy === 'check'}
                    onClick={() => run('check', async () => (await orderService.checkPayment(order.id)).order)}
                  >
                    I already paid, check again
                  </Button>
                </>
              ) : null}

              {isFarmer && order.status === 'funded' ? (
                <Button size="lg" className="w-full" isLoading={busy === 'accept'} onClick={() => run('accept', () => orderService.accept(order.id))}>
                  Accept this order
                </Button>
              ) : null}

              {isFarmer && order.status === 'preparing' ? (
                <p className="rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-200">
                  You accepted this order. Get the animals ready and wait for the driver. Nothing is paid out until the
                  buyer gives the code.
                </p>
              ) : null}

              {order.settlementId && (isFarmer || isAdmin) ? (
                <p className="text-xs leading-relaxed text-ink-500">
                  A payout record exists for this order.{' '}
                  {isFarmer ? 'It moves once the admin releases it.' : 'Release it from the payouts tab.'}
                </p>
              ) : null}

              {canCancel ? (
                isCancelOpen ? (
                  <div className="space-y-3 rounded-xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200">
                    <Input
                      label="Why are you cancelling"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      hint="Both sides see this."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={busy === 'cancel'}
                        disabled={cancelReason.trim().length < 6}
                        onClick={() => run('cancel', () => orderService.cancel(order.id, cancelReason))}
                      >
                        Cancel the order
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsCancelOpen(false)}>
                        Keep it
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="w-full" onClick={() => setIsCancelOpen(true)}>
                    Cancel this order
                  </Button>
                )
              ) : null}
            </div>
          </div>

          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">The other side</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-700">
              <li className="flex items-center gap-2">
                <FaTruck aria-hidden="true" className="size-3.5 shrink-0 text-stone-400" />
                {order.farmer?.fullName ?? 'Farm no longer active'}
              </li>
              {order.buyer ? <li>{order.buyer.fullName}</li> : null}
              {order.driver ? (
                <li className="text-xs text-ink-500">
                  Driver {order.driver.fullName} · {order.driver.phoneNumber}
                </li>
              ) : null}
            </ul>
            <Link to={`/marketplace/${order.listingId}`} className="mt-4 inline-block text-sm font-medium text-brand-700">
              Open the original listing
            </Link>
          </div>

          {order.status === 'awaiting_payment' ? (
            <div className="rounded-card bg-stone-50 p-6 ring-1 ring-stone-200">
              <h2 className="font-display text-base font-semibold text-ink-900">Nothing has left your account</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                The payment page opens when you press Pay. The money stays with Halal Livestocks until you hand over the
                collection code, and an open case stops the payout while it is read.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}
