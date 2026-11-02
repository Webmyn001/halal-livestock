import type { Order, OrderStatus } from '../../types';
import { ORDER_STEPS, ORDER_STATUS_LABELS, orderStatusStyle, stepIndex } from '../../utils/orderMeta';
import { formatDateTime } from '../../utils/format';

const DATE_FOR_STEP: Partial<Record<OrderStatus, keyof Order>> = {
  funded: 'paidAt',
  preparing: 'acceptedAt',
  out_for_delivery: 'dispatchedAt',
  confirmed: 'confirmedAt',
};

export function StatusTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return (
      <div className="rounded-xl bg-stone-50 px-4 py-3.5 ring-1 ring-inset ring-stone-200">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${orderStatusStyle(order.status)}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-700">
          {order.cancelReason ? `Reason given: ${order.cancelReason}` : 'This order is closed.'}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          {formatDateTime(String(order.cancelledAt ?? order.refundedAt ?? order.createdAt))}
        </p>
      </div>
    );
  }

  const current = stepIndex(order.status);

  return (
    <ol className="space-y-4">
      {ORDER_STEPS.map((step, index) => {
        const done = current >= index;
        const at = DATE_FOR_STEP[step.status] ? order[DATE_FOR_STEP[step.status]!] : undefined;

        return (
          <li key={step.status} className="flex gap-3.5">
            <span className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full ${
                  done ? 'bg-brand-600 text-white' : 'border border-dashed border-stone-300 text-stone-400'
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                    <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="text-[11px] font-semibold">{index + 1}</span>
                )}
              </span>
              {index < ORDER_STEPS.length - 1 ? (
                <span aria-hidden="true" className={`mt-1 w-px flex-1 ${done ? 'bg-brand-300' : 'bg-stone-200'}`} />
              ) : null}
            </span>
            <div className={`pb-1 ${done ? '' : 'opacity-60'}`}>
              <p className="text-sm font-semibold text-ink-900">
                {step.label}
                {current === index ? <span className="ml-2 text-xs font-medium text-brand-700">Now</span> : null}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{step.caption}</p>
              {done && at ? <p className="mt-1 text-[11px] text-ink-500">{formatDateTime(String(at))}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
