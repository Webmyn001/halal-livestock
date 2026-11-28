interface DashboardHeaderProps {
  eyebrow: string;
  title: string;
  caption: string;
  image: string;
  alt: string;
  aside: { label: string; value: string }[];
}

export function DashboardHeader({ eyebrow, title, caption, image, alt, aside }: DashboardHeaderProps) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-900">
      <img
        src={image}
        alt={alt}
        className="absolute inset-0 size-full object-cover opacity-45"
        width="1200"
        height="800"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/88 to-brand-900/45" />

      <div className="page-shell relative grid gap-8 py-12 sm:py-14 lg:grid-cols-[1.6fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow text-gold-300">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-3xl font-bold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-brand-100">{caption}</p>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {aside.map((item) => (
            <div key={item.label} className="min-w-0 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <dt className="text-[11px] uppercase tracking-wide text-brand-200">{item.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-white sm:truncate">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
