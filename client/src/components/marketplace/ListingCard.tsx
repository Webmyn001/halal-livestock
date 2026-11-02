import { Link } from 'react-router-dom';
import { FaLocationDot, FaUserCheck } from 'react-icons/fa6';
import type { Listing } from '../../types';
import { formatNaira } from '../../utils/format';
import { LISTING_TYPE_SHORT, SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';

export function ListingCard({ listing }: { listing: Listing }) {
  const [cover] = listing.images;

  return (
    <article className="group overflow-hidden rounded-card bg-white ring-1 ring-stone-200 shadow-card transition hover:shadow-lift">
      <Link to={`/marketplace/${listing.id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          {cover ? (
            <img
              src={cover.url}
              alt={`${listing.title} offered by ${listing.farmer?.fullName ?? 'a farmer'}`}
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
          <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-brand-800">
            {LISTING_TYPE_SHORT[listing.listingType]}
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-brand-900/72 px-2.5 py-1 text-[11px] font-semibold text-white">
            {listing.quantity} {UNIT_LABELS[listing.unit]}
            {listing.quantity > 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {SPECIES_LABELS[listing.species]}
            {listing.breed ? ` · ${listing.breed}` : ''}
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-base font-semibold text-ink-900 group-hover:text-brand-800">
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
