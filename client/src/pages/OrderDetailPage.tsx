import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FaArrowLeftLong, FaWallet, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import { Alert } from '../components/common/Alert';
import { Button, Spinner } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ChatPanel } from '../components/order/ChatPanel';
import { DisputePanel } from '../components/order/DisputePanel';
import { StatusTimeline } from '../components/order/StatusTimeline';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { orderService } from '../services/orderService';
import type { Order } from '../types';
import { formatDateTime, formatNaira } from '../utils/format';
import { LISTING_TYPE_LABELS, SPECIES_LABELS, UNIT_LABELS } from '../utils/listingMeta';
import { listingPath } from '../utils/listingUrl';
import { ORDER_STATUS_LABELS, orderStatusStyle } from '../utils/orderMeta';

/** Statuses where a buyer can report non-receipt */
const REPORT_NONRECEIPT_STATUSES: Order['status'][] = ['out_for_delivery', 'preparing', 'funded'];
/** Statuses where a buyer can mark as received */
const MARK_RECEIVED_STATUSES: Order['status'][] = ['out_for_delivery'];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState<'pay' | 'check' | 'accept' | 'cancel' | 'confirm' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  // The payment success page links here with ?report=1 so a buyer can open a case in one click.
  const [showReportForm, setShowReportForm] = useState(searchParams.get('report') === '1');

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

  async function run(action: 'pay' | 'check' | 'accept' | 'cancel' | 'confirm', task: () => Promise<Order>) {
    setBusy(action);
    setProblem('');
    try {
      setOrder(await task());
      if (action === 'cancel') setIsCancelOpen(false);
      window.dispatchEvent(new Event('halal:orders-changed'));
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
  const isAdmin = user.role === 'admin';
  const partyChat = isBuyer || isFarmer;
  const unit = order.quantity === 1 ? UNIT_LABELS[order.snapshot.unit] : `${UNIT_LABELS[order.snapshot.unit]}s`;
  const canPay = isBuyer && order.status === 'awaiting_payment';
  const canCancel = (isBuyer || isAdmin) && ['awaiting_payment', 'funded', 'preparing'].includes(order.status);
  const canMarkReceived = isBuyer && MARK_RECEIVED_STATUSES.includes(order.status);
  const canReportNonReceipt = isBuyer && REPORT_NONRECEIPT_STATUSES.includes(order.status) && !order.disputeOpen;

  // Timeline role
  const timelineRole: 'buyer' | 'farmer' | 'admin' = isFarmer ? 'farmer' : isAdmin ? 'admin' : 'buyer';

  async function handlePay() {
    setBusy('pay');
    setProblem('');
    try {
      const checkout = await orderService.startPayment(id);
      window.location.assign(checkout.authorizationUrl);
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'The payment page did not open.');
      setBusy(null);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <Link
        to={isAdmin ? '/admin/dashboard' : '/orders'}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-brand-700"
      >
        <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
        {isAdmin ? 'Admin console' : 'My orders'}
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

          {/* Order progress timeline */}
          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {isFarmer ? 'Order progress' : 'Where is my order?'}
            </h2>
            <div className="mt-5">
              <StatusTimeline order={order} role={timelineRole} />
            </div>
          </section>

          {/* Delivery info — shown when delivery details exist */}
          {order.delivery ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Delivery details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Field label="Contact name" value={order.delivery.contactName} />
                <Field label="Phone" value={order.delivery.contactPhone} />
                <Field label="Address" value={`${order.delivery.address}, ${order.delivery.town}, ${order.delivery.state}`} />
                {order.delivery.wantedDate ? (
                  <Field label="Preferred date" value={formatDateTime(order.delivery.wantedDate)} />
                ) : null}
              </dl>
              {(isBuyer || isFarmer) && order.status === 'funded' ? (
                <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-200">
                  💬 Use the chat below to agree delivery date, time and fee with the {isBuyer ? 'farmer' : 'buyer'}.
                </p>
              ) : null}
              {(isBuyer || isFarmer) && order.status === 'preparing' ? (
                <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-200">
                  💬 Agree the delivery plan in the chat below — time, location, and any delivery fee.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Chat section */}
          {partyChat ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Chat</h2>
              <p className="mt-1.5 mb-5 text-sm leading-relaxed text-ink-500">
                Talk directly with the {isBuyer ? 'farmer' : 'buyer'} here. Use this to agree on delivery details, time, and any delivery fee.
              </p>
              <ChatPanel orderId={order.id} myRole={isBuyer ? 'buyer' : 'farmer'} />
            </section>
          ) : null}

          {/* Admin: chat viewer */}
          {isAdmin ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Order messages</h2>
              <p className="mt-1.5 mb-5 text-sm leading-relaxed text-ink-500">Messages between buyer and farmer.</p>
              <ChatPanel orderId={order.id} myRole="buyer" />
            </section>
          ) : null}

          {/* Dispute / Report section */}
          {partyChat ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
              <h2 className="font-display text-lg font-semibold text-ink-900">Problem with this order?</h2>
              <div className="mt-4">
                <DisputePanel
                  orderId={order.id}
                  orderCode={order.orderCode}
                  totalKobo={order.totalKobo}
                  canOpen={['funded', 'preparing', 'out_for_delivery', 'confirmed'].includes(order.status)}
                  isBuyer={isBuyer}
                />
              </div>
            </section>
          ) : null}

        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {/* Money card */}
          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">Payment</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-500">
                  {formatNaira(order.snapshot.priceKobo)} × {order.quantity} {unit}
                </dt>
                <dd className="font-semibold text-ink-900">{formatNaira(order.totalKobo)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-500">Status</dt>
                <dd className="font-semibold text-ink-900">
                  {order.status === 'completed'
                    ? 'Paid to the farmer'
                    : order.paymentState === 'held'
                      ? 'Held safely by platform'
                      : order.paymentState === 'refunded'
                        ? 'Returned to you'
                        : 'Not paid yet'}
                </dd>
              </div>
              {order.paidAt ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-500">Paid on</dt>
                  <dd className="text-ink-900">{formatDateTime(order.paidAt)}</dd>
                </div>
              ) : null}
            </dl>

            {order.paymentReference && (isBuyer || isAdmin) ? (
              <p className="mt-3 break-all text-[11px] text-ink-500">Ref: {order.paymentReference}</p>
            ) : null}

            {order.note ? (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-700 ring-1 ring-inset ring-stone-200">
                {order.note}
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              {/* Pay button */}
              {canPay ? (
                <>
                  <Button size="lg" className="w-full" isLoading={busy === 'pay'} onClick={handlePay}>
                    <FaWallet aria-hidden="true" className="size-4" />
                    Pay now
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    isLoading={busy === 'check'}
                    onClick={() => run('check', async () => (await orderService.checkPayment(order.id)).order)}
                  >
                    I already paid — check again
                  </Button>
                </>
              ) : null}

              {/* Farmer: accept order */}
              {isFarmer && order.status === 'funded' ? (
                <Button size="lg" className="w-full" isLoading={busy === 'accept'} onClick={() => run('accept', () => orderService.accept(order.id))}>
                  Accept this order
                </Button>
              ) : null}

              {/* Farmer: preparing hint */}
              {isFarmer && order.status === 'preparing' ? (
                <p className="rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-200">
                  You accepted this order. Get the livestock ready and use the chat to agree delivery with the buyer.
                </p>
              ) : null}

              {/* Farmer: payout info */}
              {order.settlementId && (isFarmer || isAdmin) ? (
                <p className="text-xs leading-relaxed text-ink-500">
                  A payout record exists for this order.{' '}
                  {isFarmer ? 'It will be released by the admin.' : 'Release it from the Payouts tab.'}
                </p>
              ) : null}

              {/* Buyer: Mark as received */}
              {canMarkReceived ? (
                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="w-full"
                    isLoading={busy === 'confirm'}
                    onClick={() => run('confirm', () => orderService.confirm(order.id))}
                  >
                    <FaCircleCheck aria-hidden="true" className="size-4" />
                    I received the livestock
                  </Button>
                  <p className="text-center text-xs text-ink-500">
                    Only press this after you have checked and received everything.
                  </p>
                </div>
              ) : null}

              {/* Buyer: Report non-receipt */}
              {canReportNonReceipt && !showReportForm ? (
                <Button variant="ghost" className="w-full" onClick={() => setShowReportForm(true)}>
                  <FaTriangleExclamation aria-hidden="true" className="size-4 text-amber-500" />
                  I did not receive the livestock
                </Button>
              ) : null}

              {/* Cancel */}
              {canCancel ? (
                isCancelOpen ? (
                  <div className="space-y-3 rounded-xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200">
                    <Input
                      label="Why are you cancelling?"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      hint="Both sides will see this."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={busy === 'cancel'}
                        disabled={cancelReason.trim().length < 6}
                        onClick={() => run('cancel', () => orderService.cancel(order.id, cancelReason))}
                      >
                        Cancel order
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

          {/* Non-receipt report panel */}
          {showReportForm && canReportNonReceipt ? (
            <div className="rounded-card bg-amber-50 p-6 ring-1 ring-amber-200 shadow-card">
              <h2 className="font-display text-base font-semibold text-ink-900">Report: I did not receive the livestock</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                Your money is <strong>still safe</strong> with Halal Livestocks. The admin will be notified and will investigate.
              </p>
              <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-600 list-disc list-inside">
                <li>Transaction fees and service fees are non-refundable.</li>
                <li>The admin may request evidence from both sides.</li>
                <li>A refund decision is made after investigation.</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <DisputePanel
                  orderId={order.id}
                  orderCode={order.orderCode}
                  totalKobo={order.totalKobo}
                  canOpen={true}
                  isBuyer={true}
                  defaultReason="not_delivered"
                  compact
                />
                <Button variant="ghost" size="sm" onClick={() => setShowReportForm(false)}>
                  Go back
                </Button>
              </div>
            </div>
          ) : null}

          {/* Parties card */}
          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">About this order</h2>
            <dl className="mt-3 space-y-2 text-sm text-ink-700">
              {order.farmer ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Farmer</dt>
                  <dd className="font-medium">{order.farmer.fullName}</dd>
                </div>
              ) : null}
              {order.buyer ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Buyer</dt>
                  <dd className="font-medium">{order.buyer.fullName}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">From</dt>
                <dd className="font-medium">{order.snapshot.town}, {order.snapshot.state}</dd>
              </div>
            </dl>
            <Link
              to={listingPath({ id: order.listingId, title: order.snapshot.title, species: order.snapshot.species, town: order.snapshot.town, state: order.snapshot.state })}
              className="mt-4 inline-block text-sm font-medium text-brand-700"
            >
              View original listing
            </Link>
          </div>

          {/* Safety notice for awaiting payment */}
          {order.status === 'awaiting_payment' ? (
            <div className="rounded-card bg-stone-50 p-6 ring-1 ring-stone-200">
              <h2 className="font-display text-base font-semibold text-ink-900">Your money is safe</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                When you pay, your money is held securely by Halal Livestocks — not sent to the farmer. It is only released after you confirm you received the livestock.
              </p>
            </div>
          ) : null}

          {/* Safety notice once funded */}
          {order.status !== 'awaiting_payment' && order.paymentState === 'held' ? (
            <div className="rounded-card bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <p className="text-xs font-semibold text-emerald-800">🔒 Your money is held safely</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                Halal Livestocks holds your payment until you confirm receipt.
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
