import type { Order } from '../../types';
import { formatDateTime } from '../../utils/format';
import { getAdminTimeline, getBuyerTimeline, getFarmerTimeline } from '../../utils/orderMeta';

export function StatusTimeline({ order, role = 'buyer' }: { order: Order; role?: 'buyer' | 'farmer' | 'admin' }) {
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  if (isCancelled) {
    return (
      <div className="rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-stone-200 text-stone-600">×</span>
          <div>
            <p className="font-medium text-ink-800">{order.status === 'cancelled' ? 'Order cancelled' : 'Order refunded'}</p>
            <p className="mt-0.5 text-sm text-ink-500">{order.cancelReason ?? 'No reason given.'}</p>
            {order.cancelledAt || order.refundedAt ? (
              <p className="mt-1 text-xs text-ink-400">{formatDateTime(order.cancelledAt ?? order.refundedAt ?? '')}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const steps = role === 'farmer' ? getFarmerTimeline(order) : role === 'admin' ? getAdminTimeline(order) : getBuyerTimeline(order);

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
            {!last ? (
              <span className={`absolute left-[15px] top-9 h-[calc(100%-1rem)] w-0.5 ${done ? 'bg-brand-500' : 'bg-stone-200'}`} aria-hidden="true" />
            ) : null}
            <span
              className={[
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                done ? 'bg-brand-600 text-white' : current ? 'bg-brand-100 text-brand-700 ring-4 ring-brand-50' : 'bg-stone-100 text-stone-400 ring-1 ring-stone-200',
              ].join(' ')}
            >
              {done ? '✓' : index + 1}
            </span>
            <div className={current ? '' : done ? '' : 'opacity-70'}>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`font-medium ${current ? 'text-brand-800' : done ? 'text-ink-900' : 'text-ink-500'}`}>{step.label}</p>
                {current ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Current</span> : null}
              </div>
              <p className="mt-0.5 text-sm text-ink-500">{step.caption}</p>
              {step.at ? <p className="mt-1 text-xs text-ink-400">{formatDateTime(step.at)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
