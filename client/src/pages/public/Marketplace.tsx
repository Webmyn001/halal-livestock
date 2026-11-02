import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { ApiRequestError } from '../../services/apiClient';
import { listingService } from '../../services/listingService';
import { useAuth } from '../../hooks/useAuth';
import {
  LISTING_SPECIES,
  LISTING_TYPES,
  type Listing,
  type ListingFilters,
  type ListingSort,
  type ListingSpecies,
  type ListingType,
} from '../../types';
import { LISTING_TYPE_SHORT, SPECIES_PLURALS } from '../../utils/listingMeta';

const SORT_LABELS: Record<ListingSort, string> = {
  newest: 'Newest first',
  price_low: 'Price low to high',
  price_high: 'Price high to low',
};

function readSpecies(value: string | null): ListingSpecies | undefined {
  return (LISTING_SPECIES as readonly string[]).includes(value ?? '') ? (value as ListingSpecies) : undefined;
}

function readType(value: string | null): ListingType | undefined {
  return (LISTING_TYPES as readonly string[]).includes(value ?? '') ? (value as ListingType) : undefined;
}

function readSort(value: string | null): ListingSort {
  return value === 'price_low' || value === 'price_high' ? value : 'newest';
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-stone-100 text-ink-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

export function MarketplacePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ListingFilters>(
    () => ({
      species: readSpecies(searchParams.get('species')),
      type: readType(searchParams.get('type')),
      q: searchParams.get('q') ?? undefined,
      sort: readSort(searchParams.get('sort')),
      page: Number(searchParams.get('page')) || 1,
    }),
    [searchParams]
  );

  const [searchDraft, setSearchDraft] = useState(filters.q ?? '');
  const [result, setResult] = useState<{ listings: Listing[]; total: number; pages: number } | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function update(next: Partial<ListingFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.species) params.set('species', merged.species);
    if (merged.type) params.set('type', merged.type);
    if (merged.q) params.set('q', merged.q);
    if (merged.sort && merged.sort !== 'newest') params.set('sort', merged.sort);
    if (merged.page && merged.page > 1) params.set('page', String(merged.page));
    setSearchParams(params, { replace: true });
  }

  // The query box would otherwise start a request on every keystroke.
  useEffect(() => {
    if (searchDraft === (filters.q ?? '')) return;
    const timer = setTimeout(() => update({ q: searchDraft.trim() || undefined, page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listingService
      .list(filters)
      .then((data) => {
        if (cancelled) return;
        setResult({ listings: data.listings, total: data.total, pages: data.pages });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not load the marketplace', 'UNKNOWN'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const hasFilters = Boolean(filters.species || filters.type || filters.q);
  const listings = result?.listings ?? [];

  // Buyers browse, farmers post. The CTA follows whoever is looking.
  const sellTo = user?.role === 'farmer' ? '/farmer/post-livestock' : '/register';
  const sellLabel = user?.role === 'farmer' ? 'Post your stock' : 'Sell your own stock';

  return (
    <div>
      <section className="border-b border-stone-200 bg-stone-50">
        <div className="page-shell py-11 sm:py-14">
          <p className="eyebrow">Marketplace</p>
          <h1 className="mt-3 text-balance text-3xl font-bold text-ink-900 sm:text-4xl">
            Live animals and halal processed stock from verified farms
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-500">
            Every farmer here confirms an email and a phone number. Look at the photos, compare prices and message the
            farm when something fits your order.
          </p>

          <form
            role="search"
            className="mt-7 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-stone-200 shadow-card focus-within:ring-2 focus-within:ring-brand-500"
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: searchDraft.trim() || undefined, page: 1 });
            }}
          >
            <FaMagnifyingGlass aria-hidden="true" className="ml-2 size-4 shrink-0 text-stone-400" />
            <label htmlFor="marketplace-search" className="sr-only">
              Search listings
            </label>
            <input
              id="marketplace-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search rabbits, sheep, town or breed"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink-900 placeholder:text-stone-400 focus:outline-none"
            />
            {searchDraft ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearchDraft('')} aria-label="Clear search">
                <FaXmark aria-hidden="true" className="size-3.5" />
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
        </div>
      </section>

      <div className="page-shell py-10 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-3">
            <div role="group" aria-label="Animal" className="flex flex-wrap gap-2">
              <Chip active={!filters.species} onClick={() => update({ species: undefined, page: 1 })}>
                All animals
              </Chip>
              {LISTING_SPECIES.map((species) => (
                <Chip
                  key={species}
                  active={filters.species === species}
                  onClick={() => update({ species: filters.species === species ? undefined : species, page: 1 })}
                >
                  {SPECIES_PLURALS[species]}
                </Chip>
              ))}
            </div>
            <div role="group" aria-label="Form" className="flex flex-wrap gap-2">
              <Chip active={!filters.type} onClick={() => update({ type: undefined, page: 1 })}>
                Live and processed
              </Chip>
              {LISTING_TYPES.map((type) => (
                <Chip
                  key={type}
                  active={filters.type === type}
                  onClick={() => update({ type: filters.type === type ? undefined : type, page: 1 })}
                >
                  {LISTING_TYPE_SHORT[type]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="marketplace-sort" className="text-sm text-ink-500">
              Sort
            </label>
            <select
              id="marketplace-sort"
              value={filters.sort}
              onChange={(event) => update({ sort: readSort(event.target.value), page: 1 })}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
            >
              {(Object.keys(SORT_LABELS) as ListingSort[]).map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-8">
            <Alert tone="error" title="We could not load the marketplace">
              {error.message}
            </Alert>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-500" aria-live="polite">
            {isLoading
              ? 'Loading listings'
              : `${result?.total ?? 0} ${result?.total === 1 ? 'listing' : 'listings'} available`}
          </p>
          <Link to={sellTo}>
            <Button variant="secondary" size="sm">
              {sellLabel}
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-14 grid place-items-center text-brand-600">
            <Spinner className="size-8" />
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-10 rounded-card bg-white p-10 text-center ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {hasFilters ? 'No listing matches that search' : 'Farmers have not posted stock yet'}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-500">
              {hasFilters
                ? 'Try a wider animal, a different form, or clear the search to see everything on the platform.'
                : 'Be the first. Post the animals you have on the farm, add up to four photos and buyers in Oyo State will see them here.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {hasFilters ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchDraft('');
                    setSearchParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  Clear all filters
                </Button>
              ) : null}
              <Link to={sellTo}>
                <Button>{sellLabel}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>

            {result && result.pages > 1 ? (
              <nav aria-label="More listings" className="mt-10 flex items-center justify-center gap-4">
                <Button
                  variant="secondary"
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => update({ page: (filters.page ?? 1) - 1 })}
                >
                  Previous
                </Button>
                <p className="text-sm text-ink-500">
                  Page {filters.page} of {result.pages}
                </p>
                <Button
                  variant="secondary"
                  disabled={(filters.page ?? 1) >= result.pages}
                  onClick={() => update({ page: (filters.page ?? 1) + 1 })}
                >
                  Next
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
