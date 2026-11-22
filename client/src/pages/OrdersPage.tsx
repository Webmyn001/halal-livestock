import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../components/common/Alert';
import { Button, Spinner } from '../components/common/Button';
import { OrderList } from '../components/order/OrderList';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { orderService } from '../services/orderService';
import type { Order, OrderStatus } from '../types';
import { ORDER_STATUS_LABELS } from '../utils/orderMeta';

const FILTERS: (OrderStatus | 'all')[] = [
  'all',
  'awaiting_payment',
  'funded',
  'preparing',
  'out_for_delivery',
  'confirmed',
  'completed',
  'cancelled',
];

export function OrdersPage() {
  const { user } = useAuth();
  const perspective = user?.role === 'farmer' ? 'farmer' : 'buyer';

  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ApiRequestError | null>(null);

  const load = useCallback(() => {
    setOrders(null);
    setError(null);
    orderService
      .list({ scope: perspective, status: status === 'all' ? undefined : status, page })
      .then((data) => {
        setOrders(data.orders);
        setPages(data.pages);
        setTotal(data.total);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not open your orders', 'UNKNOWN'));
      });
  }, [perspective, status, page]);

  useEffect(load, [load]);

  if (!user) return null;

  return (
    <div className="page-shell py-10 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{perspective === 'buyer' ? 'Buyer account' : 'Farmer account'}</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">
            {perspective === 'buyer' ? 'My orders' : 'Orders for my farm'}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            {perspective === 'buyer'
              ? 'Every order you placed, the money on it, and what happens next.'
              : 'Accept orders, prepare your livestock, and track when the payout is on its way to your account.'}
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </header>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => {
          const active = filter === status;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setStatus(filter);
                setPage(1);
              }}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-ink-700 ring-1 ring-inset ring-stone-200 hover:ring-brand-300'
              }`}
            >
              {filter === 'all' ? 'All' : ORDER_STATUS_LABELS[filter]}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {error ? (
          <Alert tone="error" title="We could not open your orders">
            {error.message}
          </Alert>
        ) : !orders ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner className="size-8" />
          </div>
        ) : (
          <>
            <OrderList
              orders={orders}
              perspective={perspective}
              emptyTitle={perspective === 'buyer' ? 'No order with that status' : 'No order with that status yet'}
              emptyBody={
                perspective === 'buyer'
                  ? 'Clear the filter to see the rest, or start a new order from the marketplace.'
                  : 'Clear the filter to see the rest. New orders land here the moment a buyer checks out.'
              }
            />
            {pages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-xs text-ink-500">
                  Page {page} of {pages} · {total} orders
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((current) => Math.min(pages, current + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
