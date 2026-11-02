import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FaPhoneVolume, FaLocationDot } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import { deliveryService } from '../../services/deliveryService';
import type { Order } from '../../types';
import { formatDateTime, formatNaira } from '../../utils/format';
import { SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';

export function DeliveriesPage() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Order[] | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finished, setFinished] = useState<Order | null>(null);

  const load = useCallback(() => {
    setDeliveries(null);
    setError(null);
    deliveryService
      .mine()
      .then(setDeliveries)
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not load your deliveries', 'UNKNOWN'));
      });
  }, []);

  useEffect(load, [load]);

  if (!user) return null;

  async function handleSubmit(order: Order, event: FormEvent) {
    event.preventDefault();
    const code = (codes[order.id] ?? '').trim();
    if (code.length !== 6) return;

    setBusyId(order.id);
    setProblem('');
    try {
      const updated = await deliveryService.submitCode(order.id, code);
      setDeliveries((current) => (current ?? []).filter((entry) => entry.id !== updated.id));
      setFinished(updated);
      setCodes((current) => ({ ...current, [order.id]: '' }));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That code was not accepted.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-shell py-10 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Driver account</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">My deliveries</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            Collect from the farm, bring the animals to the buyer, and enter the code they read out to you. You never see
            the code before they say it.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </header>

      {finished ? (
        <div className="mt-6">
          <Alert tone="success" title={`Delivered ${finished.orderCode}`}>
            {finished.snapshot.title} was handed over. The payout to the farm starts now.{' '}
            <Link to={`/orders/${finished.id}`} className="font-semibold underline">
              Open the order
            </Link>
          </Alert>
        </div>
      ) : null}

      {problem ? (
        <div className="mt-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      ) : null}

      <div className="mt-7">
        {error ? (
          <Alert tone="error" title="We could not open your deliveries">
            {error.message}
          </Alert>
        ) : !deliveries ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner className="size-8" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="rounded-card bg-white p-8 text-center ring-1 ring-stone-200 shadow-card">
            <p className="font-display text-base font-semibold text-ink-900">Nothing on the way right now</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
              An admin assigns you when a farmer accepts an order. Refresh after a payment lands.
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {deliveries.map((order) => {
              const unit = order.quantity === 1 ? UNIT_LABELS[order.snapshot.unit] : `${UNIT_LABELS[order.snapshot.unit]}s`;
              const isBusy = busyId === order.id;

              return (
                <li key={order.id} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{order.orderCode}</p>
                      <h2 className="mt-1 truncate text-base font-semibold text-ink-900">{order.snapshot.title}</h2>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {order.quantity} {unit} · {SPECIES_LABELS[order.snapshot.species]} ·{' '}
                        {order.dispatchedAt ? `left the farm ${formatDateTime(order.dispatchedAt)}` : 'awaiting pickup'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink-900">{formatNaira(order.totalKobo)}</p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
                      <p className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                        <FaLocationDot aria-hidden="true" className="size-3.5 text-stone-400" />
                        Collect from
                      </p>
                      <p className="mt-1 text-sm text-ink-900">{order.farmer?.fullName ?? 'Farm no longer active'}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {order.snapshot.town}, {order.snapshot.state}
                      </p>
                    </div>

                    <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
                      <p className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                        <FaPhoneVolume aria-hidden="true" className="size-3.5 text-stone-400" />
                        Drop off at
                      </p>
                      <p className="mt-1 text-sm text-ink-900">
                        {order.delivery?.contactName ?? order.buyer?.fullName ?? 'Buyer'}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {order.delivery ? `${order.delivery.address}, ${order.delivery.town}` : order.snapshot.town}
                      </p>
                      {order.delivery?.contactPhone ? (
                        <a
                          href={`tel:${order.delivery.contactPhone}`}
                          className="mt-1.5 inline-block text-xs font-semibold text-brand-700 underline"
                        >
                          Call {order.delivery.contactPhone}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <form onSubmit={(event) => handleSubmit(order, event)} className="mt-5 flex flex-wrap items-end gap-3">
                    <Input
                      label="Code from the buyer"
                      value={codes[order.id] ?? ''}
                      onChange={(event) =>
                        setCodes((current) => ({ ...current, [order.id]: event.target.value.replace(/\D/g, '') }))
                      }
                      inputMode="numeric"
                      maxLength={6}
                      className="w-40 font-mono tracking-[0.3em]"
                      hint="Six digits, read out by the buyer."
                    />
                    <Button type="submit" isLoading={isBusy} disabled={(codes[order.id] ?? '').length !== 6}>
                      Confirm the handover
                    </Button>
                    <Link to={`/orders/${order.id}`}>
                      <Button variant="ghost" type="button">
                        Full order
                      </Button>
                    </Link>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-500">
        Five wrong codes lock the handover on an order. If a buyer cannot find theirs, send them to the order page, where
        the code is written in large print.
      </p>
    </div>
  );
}
