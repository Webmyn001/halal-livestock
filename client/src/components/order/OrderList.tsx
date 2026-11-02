import { Link } from 'react-router-dom';
import { Button } from '../common/Button';
import type { Order } from '../../types';
import { formatDate, formatNaira } from '../../utils/format';
import { SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';
import { ORDER_STATUS_LABELS, orderStatusStyle } from '../../utils/orderMeta';

interface OrderListProps {
  orders: Order[];
  /** Whose name is worth showing next to each order. */
  perspective: 'buyer' | 'farmer';
  emptyTitle: string;
  emptyBody: string;
}

export function OrderList({ orders, perspective, emptyTitle, emptyBody }: OrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-card bg-white p-7 text-center ring-1 ring-stone-200 shadow-card">
        <p className="font-display text-base font-semibold text-ink-900">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">{emptyBody}</p>
        {perspective === 'buyer' ? (
          <Link to="/marketplace" className="mt-5 inline-block">
            <Button>Open the marketplace</Button>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-3.5">
      {orders.map((order) => {
        const other = perspective === 'buyer' ? order.farmer : order.buyer;
        const unit = order.quantity === 1 ? UNIT_LABELS[order.snapshot.unit] : `${UNIT_LABELS[order.snapshot.unit]}s`;

        return (
          <li key={order.id}>
            <Link
              to={`/orders/${order.id}`}
              className="flex items-center gap-4 rounded-card bg-white p-4 ring-1 ring-stone-200 shadow-card transition hover:ring-brand-300"
            >
              {order.snapshot.coverImage ? (
                <span className="hidden size-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:block">
                  <img src={order.snapshot.coverImage} alt="" loading="lazy" className="size-full object-cover" />
                </span>
              ) : null}

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink-900">{order.snapshot.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${orderStatusStyle(order.status)}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  {order.disputeOpen ? (
                    <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">
                      Case open
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-xs text-ink-500">
                  {order.orderCode} · {SPECIES_LABELS[order.snapshot.species]} · {other?.fullName ?? 'Account no longer active'}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">Placed {formatDate(order.createdAt)}</span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-ink-900">{formatNaira(order.totalKobo)}</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {order.quantity} {unit}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
