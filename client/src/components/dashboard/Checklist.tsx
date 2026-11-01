export interface ChecklistItem {
  label: string;
  done: boolean;
  note?: string;
}

export function Checklist({ title, caption, items }: { title: string; caption?: string; items: ChecklistItem[] }) {
  return (
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
      {caption ? <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{caption}</p> : null}

      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item.label} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                item.done ? 'bg-brand-600 text-white' : 'border border-dashed border-stone-300 text-transparent'
              }`}
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                <path
                  d="M4 10.5 8 14.5 16 6"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm leading-relaxed">
              <span className={item.done ? 'text-ink-700' : 'font-medium text-ink-900'}>{item.label}</span>
              {item.note ? <span className="block text-xs text-ink-500">{item.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
