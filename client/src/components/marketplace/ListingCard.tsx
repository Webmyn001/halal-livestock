import { Link } from 'react-router-dom';
import { FaLocationDot, FaUserCheck } from 'react-icons/fa6';
import type { Listing } from '../../types';
import { formatNaira } from '../../utils/format';
import { LISTING_TYPE_SHORT, SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';
import { listingPath } from '../../utils/listingUrl';

function statusBadge(listing: Listing) {
  if (listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)) {
    return { label: 'SOLD', style: 'bg-red-600 text-white shadow-md' };
  }
  if (listing.status === 'under_process') {
    return { label: 'UNDER PROCESS', style: 'bg-amber-600 text-white shadow-md' };
  }
  if (listing.status === 'removed') {
    return { label: 'UNAVAILABLE', style: 'bg-stone-700 text-white shadow-md' };
  }
  return null;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const [cover] = listing.images;
  const badge = statusBadge(listing);
  const isUnavailable = Boolean(badge);

  return (
    <article className={`group overflow-hidden rounded-card bg-white ring-1 shadow-card transition ${isUnavailable ? 'ring-stone-300' : 'ring-stone-200 hover:shadow-lift'}`}>
      <Link to={listingPath(listing)} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          {cover ? (
            <img
              src={cover.url}
              alt={`${listing.title} offered by ${listing.farmer?.fullName ?? 'a farmer'}`}
              loading="lazy"
              className={`size-full object-cover transition duration-500 ${isUnavailable ? 'opacity-85 filter contrast-90' : 'group-hover:scale-[1.04]'}`}
            />
          ) : null}

          {/* Listing type chip ONLY when active and available (NEVER show Live when sold or under process) */}
          {!badge ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-brand-800 shadow-sm">
              {LISTING_TYPE_SHORT[listing.listingType]}
            </span>
          ) : null}

          {/* Quantity chip (bottom-left) — only when available */}
          {!badge ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-brand-900/72 px-2.5 py-1 text-[11px] font-semibold text-white">
              {listing.quantity} {UNIT_LABELS[listing.unit]}{listing.quantity > 1 ? 's' : ''}
            </span>
          ) : null}

          {/* Bold status overlay for sold / under process */}
          {badge ? (
            <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center p-3">
              <span className={`rounded-xl px-4 py-2 text-center text-sm font-black tracking-widest uppercase shadow-lg ring-2 ring-white/80 ${badge.style}`}>
                {badge.label}
              </span>
            </div>
          ) : null}
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
              {SPECIES_LABELS[listing.species]}
              {listing.breed ? ` · ${listing.breed}` : ''}
            </p>
            {badge ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ring-1 ring-inset ${
                badge.label === 'SOLD'
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : badge.label === 'UNDER PROCESS'
                    ? 'bg-amber-50 text-amber-800 ring-amber-200'
                    : 'bg-stone-50 text-stone-700 ring-stone-200'
              }`}>
                {badge.label}
              </span>
            ) : null}
          </div>

          <h3 className={`mt-1.5 line-clamp-2 text-base font-semibold ${isUnavailable ? 'text-ink-600' : 'text-ink-900 group-hover:text-brand-800'}`}>
            {listing.title}
          </h3>
          <p className="mt-2.5 text-xl font-bold text-ink-900">
            {formatNaira(listing.priceKobo)}
            <span className="ml-1 text-sm font-medium text-ink-500">per {UNIT_LABELS[listing.unit]}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <FaLocationDot aria-hidden="true" className="size-3 text-stone-400" />
              {listing.town}, {listing.state}
            </span>
            {listing.farmer?.isVerified ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                <FaUserCheck aria-hidden="true" className="size-3" />
                Verified farmer
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
