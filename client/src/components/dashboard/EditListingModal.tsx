import { useState, useEffect, type FormEvent } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Alert } from '../common/Alert';
import { listingService } from '../../services/listingService';
import { ApiRequestError } from '../../services/apiClient';
import type {
  Listing,
  ListingPatch,
  ListingSpecies,
  ListingStatus,
  ListingType,
  ListingUnit,
} from '../../types';
import {
  LISTING_SPECIES,
  LISTING_TYPES,
  LISTING_UNITS,
} from '../../types';
import {
  LISTING_TYPE_SHORT,
  SPECIES_LABELS,
  UNIT_LABELS,
} from '../../utils/listingMeta';

interface EditListingModalProps {
  listing: Listing | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Listing) => void;
}

export function EditListingModal({ listing, isOpen, onClose, onSaved }: EditListingModalProps) {
  if (!isOpen || !listing) return null;

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [species, setSpecies] = useState<ListingSpecies>(listing.species);
  const [listingType, setListingType] = useState<ListingType>(listing.listingType);
  const [breed, setBreed] = useState(listing.breed ?? '');
  const [quantity, setQuantity] = useState(String(listing.quantity > 0 ? listing.quantity : 1));
  const [unit, setUnit] = useState<ListingUnit>(listing.unit);
  const [priceNaira, setPriceNaira] = useState(String(Math.round(listing.priceKobo / 100)));
  const [town, setTown] = useState(listing.town);
  const [status, setStatus] = useState<ListingStatus>(listing.status === 'sold' ? 'active' : listing.status);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (listing) {
      setTitle(listing.title);
      setDescription(listing.description);
      setSpecies(listing.species);
      setListingType(listing.listingType);
      setBreed(listing.breed ?? '');
      setQuantity(String(listing.quantity > 0 ? listing.quantity : 1));
      setUnit(listing.unit);
      setPriceNaira(String(Math.round(listing.priceKobo / 100)));
      setTown(listing.town);
      setStatus(listing.status === 'sold' ? 'active' : listing.status);
      setError(null);
    }
  }, [listing]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!listing) return;
    setError(null);

    const numQty = Number(quantity);
    if (!numQty || numQty < 1) {
      setError('Please provide a quantity of at least 1.');
      return;
    }

    const numPrice = Number(priceNaira);
    if (!numPrice || numPrice < 100) {
      setError('Please provide a price of at least ₦100.');
      return;
    }

    const patch: ListingPatch = {
      title: title.trim(),
      description: description.trim(),
      species,
      listingType,
      breed: breed.trim() || undefined,
      quantity: numQty,
      unit,
      priceNaira: numPrice,
      town: town.trim(),
      status,
    };

    setIsSaving(true);
    try {
      const updated = await listingService.update(listing.id, patch);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save changes to listing.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-card bg-white p-6 shadow-2xl ring-1 ring-stone-200 sm:p-8">
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-900">Edit livestock listing</h2>
            <p className="mt-1 text-xs text-ink-500">
              Update price, new available stock, description, or listing status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-ink-500 hover:bg-stone-100 hover:text-ink-900 transition"
          >
            <FaXmark aria-hidden="true" className="size-5" />
            <span className="sr-only">Close modal</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        {listing.status === 'sold' ? (
          <div className="mt-4">
            <Alert tone="info" title="Reactivating sold stock">
              This livestock was previously sold. Entering your new stock quantity and saving will put it right back on sale in the marketplace.
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <Input
            label="Listing title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={90}
            hint="Name the livestock clearly."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="species" className="block text-sm font-medium text-ink-700">
                Livestock type
              </label>
              <select
                id="species"
                value={species}
                onChange={(e) => setSpecies(e.target.value as ListingSpecies)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
              >
                {LISTING_SPECIES.map((s) => (
                  <option key={s} value={s}>
                    {SPECIES_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="listingType" className="block text-sm font-medium text-ink-700">
                What the buyer collects
              </label>
              <select
                id="listingType"
                value={listingType}
                onChange={(e) => setListingType(e.target.value as ListingType)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
              >
                {LISTING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LISTING_TYPE_SHORT[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Quantity available"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              hint="New stock count."
            />

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-ink-700">
                Unit
              </label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as ListingUnit)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
              >
                {LISTING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Price (₦)"
              type="number"
              min={100}
              value={priceNaira}
              onChange={(e) => setPriceNaira(e.target.value)}
              required
              hint="Price per unit."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Breed (optional)"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="e.g. Yankasa, Balami"
            />
            <Input
              label="Town / Area"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              required
              placeholder="e.g. Ibadan, Ologuneru"
            />
          </div>

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            maxLength={2000}
            hint="Feeding, weight band, and collection/delivery notes."
          />

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-ink-700">
              Listing status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ListingStatus)}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
            >
              <option value="active">Active (On sale in marketplace)</option>
              <option value="sold">Sold (Marked as sold out)</option>
              <option value="removed">Removed (Taken down / hidden)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
