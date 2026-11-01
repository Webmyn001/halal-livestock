import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';

const TONES: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-brand-200 bg-brand-50 text-brand-800',
  info: 'border-stone-200 bg-stone-50 text-ink-700',
};

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3.5 text-sm ${TONES[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={`leading-relaxed ${title ? 'mt-1' : ''}`}>{children}</div>
    </div>
  );
}
