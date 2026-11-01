import { Link } from 'react-router-dom';

export interface ImageTile {
  to: string;
  title: string;
  body: string;
  image: string;
  alt: string;
}

export function ImageTiles({ heading, tiles }: { heading: string; tiles: ImageTile[] }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-ink-900">{heading}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="group relative isolate flex min-h-44 flex-col justify-end overflow-hidden rounded-card p-5 ring-1 ring-brand-900/10 transition hover:shadow-lift"
          >
            <img
              src={tile.image}
              alt={tile.alt}
              loading="lazy"
              className="absolute inset-0 -z-10 size-full object-cover transition duration-500 group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/10" />
            <h3 className="text-base font-semibold text-white">{tile.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-brand-100">{tile.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
