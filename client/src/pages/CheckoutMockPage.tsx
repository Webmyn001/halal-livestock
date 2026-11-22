import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaShieldHalved } from 'react-icons/fa6';
import { Alert } from '../components/common/Alert';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { orderService } from '../services/orderService';

/**
 * Stands in for the Paystack page while PAYMENT_PROVIDER is mock, so the whole money loop can be
 * walked without live keys. The real provider sends the buyer to its own hosted checkout instead.
 */
export function CheckoutMockPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const reference = params.get('reference') ?? '';
  const orderId = params.get('orderId') ?? '';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);

  async function handlePay() {
    setBusy(true);
    setError(null);
    try {
      const completed = await orderService.completeMockPayment(reference);
      const targetOrder = orderId || completed.id;
      navigate(
        `/orders/return?reference=${encodeURIComponent(reference)}&order=${encodeURIComponent(targetOrder)}&mock=1`,
        { replace: true }
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('That payment did not register', 'UNKNOWN'));
      setBusy(false);
    }
  }

  return (
    <div className="page-shell py-14 sm:py-20">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card sm:p-9">
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
            <FaShieldHalved aria-hidden="true" className="size-3" />
            Test payment page
          </p>
          <h1 className="mt-4 text-balance text-2xl font-bold text-ink-900">Confirm the payment</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            This platform is running with the test payment provider, so no card is charged and no money moves. Press the
            button and the order is treated as paid. The amount stays held by the platform until you confirm you received
            the animals.
          </p>

          <dl className="mt-6 space-y-2.5 rounded-xl bg-stone-50 px-4 py-3.5 text-sm ring-1 ring-inset ring-stone-200">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-500">Reference</dt>
              <dd className="break-all font-medium text-ink-900">{reference || 'Missing'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-500">Paying as</dt>
              <dd className="font-medium text-ink-900">{user?.email ?? 'Not signed in'}</dd>
            </div>
          </dl>

          <div className="mt-6 space-y-3">
            {error ? <Alert tone="error" title="The payment did not register">{error.message}</Alert> : null}

            {!reference ? (
              <Alert tone="error" title="This page needs a payment reference">
                Open the order and press the pay button again.
              </Alert>
            ) : !user ? (
              <Alert tone="info" title="Sign in first">
                <Link to="/login" className="font-semibold underline">
                  Log in
                </Link>{' '}
                with the buyer account that placed the order, then press pay again.
              </Alert>
            ) : (
              <>
                <Button size="lg" className="w-full" isLoading={busy} onClick={handlePay}>
                  Pay the held amount
                </Button>
                <Link to="/orders" className="block">
                  <Button variant="ghost" className="w-full">
                    Back to my orders without paying
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs leading-relaxed text-ink-500">
          Switch PAYMENT_PROVIDER to paystack and add the live keys and this page disappears. Buyers then pay on the
          Paystack host and the platform hears about it through a signed webhook.
        </p>
      </div>
    </div>
  );
}
