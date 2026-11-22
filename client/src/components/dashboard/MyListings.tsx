import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { FaPlus, FaXmark } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { ApiRequestError } from '../../services/apiClient';
import {
  ACCEPTED_TYPES,
  MAX_PHOTOS,
  MAX_TOTAL_BYTES,
  listingService,
  megabytes,
  totalBytes,
} from '../../services/listingService';
import type { Listing, ListingStatus } from '../../types';
import { formatNaira } from '../../utils/format';
import { SPECIES_LABELS, STATUS_LABELS, STATUS_STYLES, UNIT_LABELS } from '../../utils/listingMeta';

export function MyListings() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [problem, setProblem] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const replace = useCallback((next: Listing) => {
    setListings((current) => (current ?? []).map((listing) => (listing.id === next.id ? next : listing)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listingService
      .mine()
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not load your listings', 'UNKNOWN'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setStatus(listing: Listing, status: ListingStatus) {
    setBusyId(listing.id);
    setProblem('');
    try {
      replace(await listingService.update(listing.id, { status }));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That change did not save.');
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(listing: Listing, publicId: string) {
    setBusyId(listing.id);
    setProblem('');
    try {
      replace(await listingService.removePhoto(listing.id, publicId));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That photo is still on the listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function addPhotos(listing: Listing, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = MAX_PHOTOS - listing.images.length;
    if (files.length > room) {
      setProblem(`This listing has space for ${room} more ${room === 1 ? 'photo' : 'photos'}.`);
      return;
    }
    const bytes = totalBytes(files);
    if (bytes > MAX_TOTAL_BYTES) {
      setProblem(`That set is ${megabytes(bytes)}. Keep it under ${megabytes(MAX_TOTAL_BYTES)}.`);
      return;
    }

    setBusyId(listing.id);
    setProblem('');
    try {
      replace(await listingService.addPhotos(listing.id, files));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'Those photos did not upload.');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <section>
        <h2 className="font-display text-lg font-semibold text-ink-900">My listings</h2>
        <div className="mt-4">
          <Alert tone="error" title="We could not open your listings">
            {error.message}
          </Alert>
        </div>
      </section>
    );
  }

  if (!listings) {
    return (
      <section>
        <h2 className="font-display text-lg font-semibold text-ink-900">My listings</h2>
        <div className="mt-6 grid place-items-center py-8 text-brand-600">
          <Spinner className="size-7" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          My listings
          <span className="ml-2 text-sm font-normal text-ink-500">
            {listings.length === 0 ? 'None yet' : `${listings.length} posted`}
          </span>
        </h2>
        <Link to="/farmer/post-livestock">
          <Button size="sm" variant="secondary">
            <FaPlus aria-hidden="true" className="size-3" />
            Post livestock
          </Button>
        </Link>
      </div>

      {problem ? (
        <div className="mt-4">
          <Alert tone="error">{problem}</Alert>
        </div>
      ) : null}

      {listings.length === 0 ? (
        <div className="mt-4 rounded-card bg-white p-7 text-center ring-1 ring-stone-200 shadow-card">
          <p className="text-sm leading-relaxed text-ink-500">
            Nothing on sale yet. The first listing takes a title, a description, a price and one clear photo of the
            livestock.
          </p>
          <Link to="/farmer/post-livestock" className="mt-5 inline-block">
            <Button>Post your first stock</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {listings.map((listing) => {
            const [cover] = listing.images;
            const room = MAX_PHOTOS - listing.images.length;
            const isBusy = busyId === listing.id;

            return (
              <li
                key={listing.id}
                className="rounded-card bg-white p-4 ring-1 ring-stone-200 shadow-card sm:p-5"
              >
                <div className="flex flex-wrap gap-4 sm:flex-nowrap">
                  <Link
                    to={`/marketplace/${listing.id}`}
                    className="size-24 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200"
                  >
                    {cover ? (
                      <img src={cover.url} alt={listing.title} loading="lazy" className="size-full object-cover" />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-ink-500">
                          {SPECIES_LABELS[listing.species]} · {listing.town}
                        </p>
                        <h3 className="mt-0.5 truncate text-sm font-semibold text-ink-900">{listing.title}</h3>
                        <p className="mt-1 text-sm text-ink-700">
                          {formatNaira(listing.priceKobo)} per {UNIT_LABELS[listing.unit]} · {listing.quantity} available
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[listing.status]}`}
                      >
                        {STATUS_LABELS[listing.status]}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {listing.status === 'active' ? (
                        <>
                          <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => setStatus(listing, 'sold')}>
                            Mark sold
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setStatus(listing, 'removed')}>
                            Take down
                          </Button>
                        </>
                      ) : listing.status === 'under_process' ? (
                        <>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                            ⏳ Order in progress with buyer
                          </span>
                          <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => setStatus(listing, 'sold')}>
                            Mark sold
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => setStatus(listing, 'active')}>
                          {listing.status === 'sold' ? 'List again' : 'Put it back up'}
                        </Button>
                      )}
                      <Link to={`/marketplace/${listing.id}`}>
                        <Button size="sm" variant="ghost">
                          View as a buyer
                        </Button>
                      </Link>
                      {isBusy ? <Spinner className="size-4 text-brand-600" /> : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {listing.images.map((image, index) => {
                        const publicId = image.publicId;
                        return (
                          <div
                            key={image.url}
                            className="relative size-14 overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200"
                          >
                            <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
                            {publicId ? (
                              <button
                                type="button"
                                onClick={() => removePhoto(listing, publicId)}
                                disabled={isBusy || listing.images.length === 1}
                                aria-label={`Remove photo ${index + 1} from ${listing.title}`}
                                title={listing.images.length === 1 ? 'A listing needs one photo' : undefined}
                                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white/92 text-ink-700 shadow transition hover:bg-white hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-55"
                              >
                                <FaXmark aria-hidden="true" className="size-2.5" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}

                      {room > 0 ? (
                        <label className="grid size-14 cursor-pointer place-items-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-ink-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-within:ring-2 focus-within:ring-brand-500">
                          <FaPlus aria-hidden="true" className="size-4" />
                          <span className="sr-only">Add a photo to {listing.title}</span>
                          <input
                            type="file"
                            accept={ACCEPTED_TYPES.join(',')}
                            multiple
                            className="sr-only"
                            onChange={(event) => addPhotos(listing, event)}
                          />
                        </label>
                      ) : null}
                      <p className="text-xs text-ink-500">
                        {listing.images.length} of {MAX_PHOTOS} photos
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
