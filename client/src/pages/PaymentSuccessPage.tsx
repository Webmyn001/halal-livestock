import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaCircleCheck } from 'react-icons/fa6';
import { Alert } from '../components/common/Alert';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { orderService } from '../services/orderService';
import type { Order } from '../types';
import { formatNaira } from '../utils/format';

const MAX_CHECKS = 10;

export function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const orderId = params.get('order') ?? '';
  const reference = params.get('reference') ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const check = useCallback(async () => {
    if (!orderId) return;
    setBusy(true);
    setError('');
    try {
      const result = await orderService.checkPayment(orderId);
      setOrder(result.order);
      setPaid(result.paid);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'We could not confirm the payment. Please try again.');
    } finally {
      setBusy(false);
      setAttempts((current) => current + 1);
    }
  }, [orderId]);

  useEffect(() => {
    void check();
  }, [check]);

  // A webhook normally funds the order before the browser returns. If it is a little late, keep
  // checking instead of showing a failure or asking the buyer to pay a second time.
  useEffect(() => {
    if (paid || error || attempts >= MAX_CHECKS) return;
    const timer = window.setTimeout(() => void check(), 4_000);
    return () => window.clearTimeout(timer);
  }, [paid, error, attempts, check]);

  if (!orderId) {
    return (
      <div className="page-shell py-14">
        <div className="mx-auto max-w-xl">
          <Alert tone="error" title="We cannot find that payment">
            The return link is missing its order. Open your orders and use <strong>I already paid — check again</strong> on
            the order you just paid for.
          </Alert>
          <Link to="/orders" className="mt-5 inline-block text-sm font-semibold text-brand-700 underline">
            Go to my orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-shell py-14">
        <div className="mx-auto max-w-xl space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="rounded-card bg-white p-7 text-center ring-1 ring-stone-200 shadow-card sm:p-9">
            <p className="text-sm text-ink-500">
              {busy || attempts === 0 ? 'Checking your payment…' : 'Still waiting for the payment to be confirmed.'}
            </p>
            <div className="mt-4">
              <Button onClick={() => void check()} isLoading={busy} disabled={busy}>
                Check again
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-ink-500">
            Signed in as {user?.email ?? 'your account'}. Do not pay twice while this page is checking.
          </p>
        </div>
      </div>
    );
  }

  if (!paid) {
    return (
      <div className="page-shell py-14">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert tone="info" title="Confirming your payment">
            Your bank may have taken the money while we wait for the provider to confirm it. This page checks again
            automatically. Keep it open for a moment and do not pay a second time.
          </Alert>
          <div className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card sm:p-9">
            <h1 className="text-xl font-bold text-ink-900">Order {order.orderCode}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Amount: {formatNaira(order.totalKobo)}
              {reference ? <span className="mt-1 block break-all text-xs">Reference: {reference}</span> : null}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => void check()} isLoading={busy} disabled={busy}>
                I already paid — check again
              </Button>
              <Link to={`/orders/${order.id}`}>
                <Button variant="secondary">Open the order</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-12 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-card bg-white p-7 text-center ring-1 ring-stone-200 shadow-card sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            <FaCircleCheck aria-hidden="true" className="size-7" />
          </span>
          <h1 className="mt-5 text-balance text-2xl font-bold text-ink-900 sm:text-3xl">Payment successful</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {formatNaira(order.totalKobo)} for order {order.orderCode} is held safely by Halal Livestocks — not sent to
            the farmer yet. The farmer has been told to prepare your order.
          </p>
        </div>

        <Alert tone="success" title="Your money is safe">
          It is only released after you confirm you received the animals. If something goes wrong, you can open a case
          and the money stays with us while it is investigated.
        </Alert>

        <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
          <h2 className="font-display text-base font-semibold text-ink-900">How to follow your order</h2>
          <ol className="mt-4 space-y-4 text-sm leading-relaxed text-ink-600">
            <li>
              <strong className="text-ink-900">1. Track progress.</strong> Open{' '}
              <Link to={`/orders/${order.id}`} className="font-semibold text-brand-700 underline">
                your order
              </Link>{' '}
              to see each step: payment held, farmer preparing, delivery, and confirmation.
            </li>
            <li>
              <strong className="text-ink-900">2. Agree delivery in chat.</strong> Use the chat on that page to settle the
              time, place and any delivery fee with the farmer.
            </li>
            <li>
              <strong className="text-ink-900">3. Report a problem if you need to.</strong> If the animals do not arrive
              or anything is wrong, open a case from the order page. Your money stays safe while the admin investigates.
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={`/orders/${order.id}`}>
              <Button>Open my order</Button>
            </Link>
            <Link to={`/orders/${order.id}?report=1`}>
              <Button variant="secondary">Report a problem</Button>
            </Link>
            <Link to="/notifications">
              <Button variant="ghost">See notifications</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
