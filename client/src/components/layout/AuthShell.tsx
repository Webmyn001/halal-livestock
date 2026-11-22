import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import appLogo from '../../utils/Halal Livestock Marketplace Logo.png';

const POINTS = [
  'Farmers prove who they are before a listing gets the verified badge.',
  'Delivery time, place and fee are agreed between buyer and farmer directly in the order chat.',
  'The payout is only released after the buyer confirms they received the livestock.',
];

export function AuthShell({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-65px)] lg:grid-cols-2">
      <div className="page-shell flex items-center justify-center py-14">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-2.5">
            <img src={appLogo} alt="Halal Livestocks" className="size-10 rounded-xl object-contain shadow-sm" />
            <span className="font-display text-xl font-bold text-ink-900">Halal Livestocks</span>
          </Link>
          <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
          <p className="mt-2 text-ink-500">{caption}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative isolate hidden overflow-hidden bg-brand-900 lg:block">
        <img
          src="/images/sheep.jpg"
          alt="A flock of sheep walking home at dusk past rural buildings"
          className="absolute inset-0 size-full object-cover opacity-40"
          loading="lazy"
          width="900"
          height="900"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="eyebrow text-gold-300">Why traders stay</p>
          <ul className="mt-5 space-y-3 text-brand-100">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
