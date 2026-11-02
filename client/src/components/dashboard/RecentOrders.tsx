import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../common/Alert';
import { Button, Spinner } from '../common/Button';
import { ApiRequestError } from '../../services/apiClient';
import { orderService } from '../../services/orderService';
import type { Order } from '../../types';
import { OrderList } from '../order/OrderList';

export function RecentOrders({ perspective }: { perspective: 'buyer' | 'farmer' }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    orderService
      .list({ scope: perspective, limit: 5 })
      .then((data) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : 'We could not open your orders.');
      });
    return () => {
      cancelled = true;
    };
  }, [perspective]);

  const emptyBody =
    perspective === 'buyer'
      ? 'Ordering starts on any listing. You pick the quantity, the address and the day, then pay on the next page.'
      : 'An order lands here the moment a buyer checks out on one of your listings.';

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {perspective === 'buyer' ? 'Recent orders' : 'Orders to work on'}
        </h2>
        <Link to="/orders">
          <Button size="sm" variant="secondary">
            All orders
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        {error ? (
          <Alert tone="error" title="We could not open your orders">
            {error}
          </Alert>
        ) : !orders ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : (
          <OrderList
            orders={orders}
            perspective={perspective}
            emptyTitle={perspective === 'buyer' ? 'No order yet' : 'No order yet'}
            emptyBody={emptyBody}
          />
        )}
      </div>
    </section>
  );
}
