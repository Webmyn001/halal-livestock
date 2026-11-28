import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../components/common/Alert';
import { Button, Spinner } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { DisputePanel } from '../components/order/DisputePanel';
import { ChatPanel } from '../components/order/ChatPanel';
import { StatusTimeline } from '../components/order/StatusTimeline';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { orderService } from '../services/orderService';
import type { Order } from '../types';
import { formatDateTime, formatNaira } from '../utils/format';
import { LISTING_TYPE_LABELS, SPECIES_LABELS, UNIT_LABELS } from '../utils/listingMeta';
import { listingPath } from '../utils/listingUrl';
import { ORDER_STATUS_LABELS, orderStatusStyle, payoutStatusLabel } from '../utils/orderMeta';

function canBuyerCancel(status: Order['status']): boolean {
  return ['awaiting_payment', 'funded', 'preparing'].includes(status);
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dispatchEtaValue, setDispatchEtaValue] = useState(2);
  const [dispatchEtaUnit] = useState<'hours' | 'days'>('days');
  const [dispatchNote, setDispatchNote] = useState('');
  const [remindOpen, setRemindOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await orderService.get(id);
      setOrder(loaded);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function run(label: string, task: () => Promise<Order | void>) {
    setBusy(label);
    setError('');
    setNote('');
    try {
      const next = await task();
      if (next) setOrder(next);
      window.dispatchEvent(new Event('halal:orders-changed'));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="size-6 text-brand-700" /></div>;
  if (!order || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert tone="error">{error || 'This order could not be found.'}</Alert>
        <Link to="/orders" className="mt-4 inline-block text-sm font-medium text-brand-700">Back to orders</Link>
      </div>
    );
  }

  const isBuyer = user.role === 'buyer' && order.isBuyer;
  const isFarmer = user.role === 'farmer' && order.isFarmer;
  const isAdmin = user.role === 'admin';
  const canPay = isBuyer && order.status === 'awaiting_payment';
  const canCancel = (isBuyer || isAdmin) && canBuyerCancel(order.status);
  const canDispatch = isFarmer && ['funded', 'preparing'].includes(order.status) && !order.disputeOpen;
  const canConfirm = isBuyer && ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'preparing'].includes(order.status) && !order.disputeOpen;
  const canReport = isBuyer && !order.disputeOpen && ['funded', 'preparing', 'out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue', 'confirmed', 'awaiting_farmer_payout'].includes(order.status);
  const canRemindPayout = isFarmer && !order.disputeOpen && order.payoutStatus !== 'paid' && ['confirmed', 'awaiting_farmer_payout'].includes(order.status);
  const timelineRole = isFarmer ? 'farmer' : isAdmin ? 'admin' : 'buyer';

  async function handlePay() {
    if (!order) return;
    await run('pay', async () => {
      const checkout = await orderService.startPayment(order.id);
      window.location.assign(checkout.authorizationUrl);
    });
  }

  async function handleCheckPayment() {
    if (!order) return;
    await run('check', async () => {
      const result = await orderService.checkPayment(order.id);
      setNote(result.paid ? 'Payment confirmed. The farmer has been notified.' : 'Payment is not confirmed yet. If you paid, wait a moment and check again.');
      return result.order;
    });
  }

   async function handleDispatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    await run('dispatch', async () => {
      const next = await orderService.dispatch(order.id, { etaValue: dispatchEtaValue, etaUnit: dispatchEtaUnit, note: dispatchNote || undefined });
      setNote('Livestock dispatched. The buyer has been notified of the expected delivery time.');
      return next;
    });
  }

  async function handleConfirm() {
    if (!order) return;
    await run('confirm', async () => {
      const next = await orderService.confirm(order.id);
      setConfirmOpen(false);
      setNote('Receipt confirmed. The transaction is now awaiting admin payout processing.');
      return next;
    });
  }

  async function handleRemindPayout() {
    if (!order) return;
    await run('remind-payout', async () => {
      await orderService.remindPayout(order.id);
      setRemindOpen(false);
      setNote('Reminder sent to admin. They will see it in their notifications.');
    });
  }

  async function handleCancel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    if (cancelReason.trim().length < 6) { setError('Please give a short reason (at least 6 characters).'); return; }
    await run('cancel', async () => {
      const next = await orderService.cancel(order.id, cancelReason.trim());
      setCancelOpen(false);
      setCancelReason('');
      setNote(next.status === 'refunded' ? 'Order cancelled and refund requested.' : 'Order cancelled.');
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={isAdmin ? '/admin/dashboard' : '/orders'} className="text-sm font-medium text-brand-700 hover:underline">
            ← {isAdmin ? 'Back to admin' : 'Back to orders'}
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Order {order.orderCode}</p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">{order.snapshot.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {SPECIES_LABELS[order.snapshot.species]} · {LISTING_TYPE_LABELS[order.snapshot.listingType]} · {order.quantity} {UNIT_LABELS[order.snapshot.unit]}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${orderStatusStyle(order.status)}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {error ? <div className="mt-6"><Alert tone="error">{error}</Alert></div> : null}
      {note ? <div className="mt-6"><Alert tone="success">{note}</Alert></div> : null}
      {order.disputeOpen ? <div className="mt-6"><Alert tone="info">A dispute is open on this order. Payout is suspended until admin resolves it.</Alert></div> : null}
      {!order.disputeOpen ? (
        <div className="mt-6 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
          <span className="font-semibold">Next step: </span>
          {isBuyer ? (
            order.status === 'awaiting_payment' ? 'Complete your payment to place this order.'
            : ['funded', 'preparing'].includes(order.status) ? 'Wait for the farmer to set the delivery time.'
            : ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(order.status) ? 'When you receive the livestock, confirm receipt. If there is a problem, report it.'
            : ['confirmed', 'awaiting_farmer_payout'].includes(order.status) ? 'Delivery confirmed. Admin will pay the farmer.'
            : order.status === 'completed' ? 'Deal complete. Thank you.'
            : order.status === 'refunded' ? 'This order was refunded.'
            : order.status === 'cancelled' ? 'This order was cancelled.'
            : 'Check the timeline below for updates.'
          ) : isFarmer ? (
            order.status === 'awaiting_payment' ? 'Waiting for buyer payment.'
            : ['funded', 'preparing'].includes(order.status) ? 'Set how many days delivery will take.'
            : ['out_for_delivery', 'awaiting_buyer_confirmation', 'delivery_overdue'].includes(order.status) ? 'Waiting for the buyer to confirm delivery.'
            : ['confirmed', 'awaiting_farmer_payout'].includes(order.status) ? 'Buyer confirmed delivery. Waiting for admin payout.'
            : order.status === 'completed' ? 'Payout received. Deal complete.'
            : order.status === 'refunded' ? 'This order was refunded.'
            : order.status === 'cancelled' ? 'This order was cancelled.'
            : 'Check the timeline below for updates.'
          ) : (
            ['confirmed', 'awaiting_farmer_payout'].includes(order.status) ? 'Buyer confirmed delivery. Review and pay the farmer.'
            : order.status === 'completed' ? 'Deal complete. Payout released.'
            : order.status === 'disputed' ? 'Resolve the dispute before payout.'
            : 'Monitor this transaction from the timeline below.'
          )}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
            <h2 className="font-display text-xl text-ink-900">Order tracking</h2>
            <div className="mt-6"><StatusTimeline order={order} role={timelineRole} /></div>
          </section>

          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Buyer information</p>
                <h2 className="mt-1 font-display text-xl text-ink-900">Delivery details</h2>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">Order {order.orderCode}</span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Buyer name</p>
                <p className="mt-2 text-sm font-semibold text-ink-900">{order.delivery?.contactName || order.buyer?.fullName || 'Not provided'}</p>
              </div>

              <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Phone number</p>
                {order.delivery?.contactPhone ? (
                  <a href={`tel:${order.delivery.contactPhone.replace(/[^\d+]/g, '')}`} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
                    {order.delivery.contactPhone}
                  </a>
                ) : (
                  <p className="mt-2 text-sm font-medium text-ink-900">No phone number</p>
                )}
              </div>

              <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Delivery address</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-900">
                  {[order.delivery?.address, order.delivery?.town, order.delivery?.state].filter(Boolean).join(', ') || 'Not provided'}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Order placed</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Buyer wants delivery by</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{order.delivery?.wantedDate ? formatDateTime(order.delivery.wantedDate) : 'Not set'}</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Dispatched</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{order.dispatchedAt ? formatDateTime(order.dispatchedAt) : 'Not yet'}</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Expected arrival</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{order.expectedDeliveryAt ? formatDateTime(order.expectedDeliveryAt) : (order.deliveryEtaValue ? `${order.deliveryEtaValue} ${order.deliveryEtaUnit}` : 'Not provided')}</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Delivery note</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-900">{order.deliveryNote || '—'}</p>
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
              Delivery fee, if any, is agreed directly between buyer and farmer and is not collected through HalalLivestock.
            </p>
          </section>

          {(isBuyer || isFarmer) ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
              <h2 className="font-display text-xl text-ink-900">Messages</h2>
              <p className="mt-1 text-sm text-ink-500">Agree on livestock condition and delivery arrangements here. Keep payment on HalalLivestock.</p>
              <div className="mt-4"><ChatPanel orderId={order.id} myRole={isFarmer ? 'farmer' : 'buyer'} /></div>
            </section>
          ) : null}

          {isAdmin && (order.buyer || order.farmer) ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
              <h2 className="font-display text-xl text-ink-900">Conversation (admin view)</h2>
              <p className="mt-1 text-sm text-ink-500">Read-only visibility for support and dispute resolution.</p>
              <div className="mt-4"><ChatPanel orderId={order.id} myRole="buyer" /></div>
            </section>
          ) : null}

          {(isBuyer || isFarmer) ? (
            <section id="report-problem" className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
              <h2 className="font-display text-xl text-ink-900">Problem with this order?</h2>
              <p className="mt-1 text-sm text-ink-500">Report issues with evidence. Disputes suspend payout until admin review.</p>
              <div className="mt-4">
                <DisputePanel
                  orderId={order.id}
                  orderCode={order.orderCode}
                  totalKobo={order.totalKobo}
                  canOpen={canReport}
                  isBuyer={isBuyer}
                  onChanged={() => void load()}
                />
              </div>
            </section>
          ) : null}

          {isAdmin && order.timeline?.length ? (
            <section className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
              <h2 className="font-display text-xl text-ink-900">Transaction timeline</h2>
              <ul className="mt-4 space-y-3">
                {order.timeline.map((event, i) => (
                  <li key={`${event.type}-${event.at}-${i}`} className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">{event.label}</p>
                      <p className="text-xs text-ink-400">{formatDateTime(event.at)}</p>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{event.actorRole}{event.note ? ` · ${event.note}` : ''}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
            <h2 className="font-display text-lg text-ink-900">Payment</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Field label="Total" value={formatNaira(order.totalKobo)} />
              <Field label="Payment" value={order.paymentState === 'held' ? 'Held by HalalLivestock' : order.paymentState === 'refunded' ? 'Refunded' : 'Not paid yet'} />
              <Field label="Payout" value={payoutStatusLabel(order.payoutStatus)} />
              <Field label="Paid at" value={order.paidAt ? formatDateTime(order.paidAt) : '—'} />
              {(isBuyer || isAdmin) && order.paymentReference ? <Field label="Reference" value={order.paymentReference} /> : null}
            </dl>

            {canPay ? (
              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={() => void handlePay()} disabled={busy !== null}>{busy === 'pay' ? 'Opening...' : 'Pay now'}</Button>
                <Button variant="secondary" className="w-full" onClick={() => void handleCheckPayment()} disabled={busy !== null}>{busy === 'check' ? 'Checking...' : 'I have paid, check status'}</Button>
              </div>
            ) : null}

            {canDispatch ? (
              <form onSubmit={handleDispatch} className="mt-5 space-y-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200">
                <p className="text-sm font-semibold text-brand-900">Payment received - start delivery</p>
                <p className="text-xs text-brand-800">Tell the buyer how many days it will take to deliver the livestock.</p>
                <label className="block text-xs font-medium text-ink-700">Delivery days</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={60} value={dispatchEtaValue} onChange={(e) => setDispatchEtaValue(Number(e.target.value))} className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                  <span className="text-sm text-ink-600">day(s)</span>
                </div>
                <Textarea label="Note to buyer (optional)" value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. We will deliver to the agreed location in the morning." />
                <Button type="submit" className="w-full" disabled={busy !== null}>{busy === 'dispatch' ? 'Saving...' : 'Confirm delivery time'}</Button>
              </form>
            ) : null}

            {canConfirm ? (
              <div className="mt-5 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <p className="text-sm font-medium text-emerald-900">Have you received your livestock?</p>
                <p className="mt-1 text-xs text-emerald-800">Confirm only when the livestock arrived and matches your agreement with the farmer.</p>
                {!confirmOpen ? (
                  <div className="mt-3 grid gap-2">
                    <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={busy !== null}>Confirm Receipt</Button>
                    <a href="#report-problem" className="block"><Button variant="secondary" className="w-full" disabled={busy !== null}>Report a Problem</Button></a>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-ink-700">Have you received the livestock and confirmed that it matches your agreement with the farmer?</p>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => void handleConfirm()} disabled={busy !== null}>{busy === 'confirm' ? 'Confirming...' : 'Yes, confirm'}</Button>
                      <Button variant="ghost" className="flex-1" onClick={() => setConfirmOpen(false)}>Not yet</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {canReport && !canConfirm ? (
              <div className="mt-5">
                <a href="#report-problem"><Button variant="secondary" className="w-full">Report a Problem</Button></a>
              </div>
            ) : null}

            {canRemindPayout ? (
              <div className="mt-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm font-medium text-amber-900">Awaiting admin payout</p>
                <p className="mt-1 text-xs text-amber-800">If payment is taking long, you can send a reminder to admin.</p>
                {!remindOpen ? (
                  <Button variant="secondary" className="mt-3 w-full" onClick={() => setRemindOpen(true)} disabled={busy !== null}>
                    Remind admin to pay
                  </Button>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-ink-700 ring-1 ring-amber-100">
                      <p className="font-semibold text-ink-900">Reminder message</p>
                      <p className="mt-1">
                        Payout pending for {order.orderCode}. Farmer: {order.farmer?.fullName || 'Farmer'}. Buyer: {order.buyer?.fullName || order.delivery?.contactName || 'Buyer'}. Livestock: {order.snapshot.title}. Buyer confirmed delivery; please review and pay farmer.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => void handleRemindPayout()} disabled={busy !== null}>
                        {busy === 'remind-payout' ? 'Sending...' : 'Send reminder'}
                      </Button>
                      <Button variant="ghost" className="flex-1" onClick={() => setRemindOpen(false)} disabled={busy !== null}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {isBuyer && canCancel ? (
              <div className="mt-5 border-t border-stone-100 pt-4">
                {!cancelOpen ? (
                  <button type="button" onClick={() => setCancelOpen(true)} className="text-sm text-ink-500 underline hover:text-ink-700">Cancel this order</button>
                ) : (
                  <form onSubmit={handleCancel} className="space-y-3">
                    <Textarea label="Reason for cancelling" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={300} />
                    <div className="flex gap-2">
                      <Button type="submit" variant="danger" size="sm" disabled={busy !== null}>{busy === 'cancel' ? 'Cancelling...' : 'Confirm cancel'}</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>Keep order</Button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200/80">
            <h2 className="font-display text-lg text-ink-900">Order details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {order.farmer ? <Field label="Farmer" value={order.farmer.fullName} /> : null}
              {order.buyer ? <Field label="Buyer" value={order.buyer.fullName} /> : null}
              <Field label="Quantity" value={`${order.quantity} ${UNIT_LABELS[order.snapshot.unit]}`} />
              <Field label="From" value={`${order.snapshot.town}, ${order.snapshot.state}`} />
              <Field label="Delivery fee" value="Agreed outside HalalLivestock" />
            </dl>
            <Link to={listingPath({ id: order.listingId, title: order.snapshot.title, species: order.snapshot.species, town: order.snapshot.town, state: order.snapshot.state })} className="mt-4 inline-block text-sm font-medium text-brand-700">View original listing</Link>
          </div>



          {isBuyer && order.status === 'awaiting_payment' ? (
            <div className="rounded-card bg-amber-50 p-5 ring-1 ring-amber-200">
              <p className="text-xs font-semibold text-amber-800">🔒 How your payment is protected</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">Your money is held by HalalLivestock until you confirm the livestock arrived as agreed. Delivery fee is arranged directly with the farmer.</p>
            </div>
          ) : null}

          {isBuyer && order.paymentState === 'held' ? (
            <div className="rounded-card bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <p className="text-xs font-semibold text-emerald-800">🔒 Payment held safely</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700">HalalLivestock holds this payment until delivery is confirmed and any dispute is resolved.</p>
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
