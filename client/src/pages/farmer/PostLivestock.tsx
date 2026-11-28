import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { PhotoPicker } from '../../components/marketplace/PhotoPicker';
import { ApiRequestError } from '../../services/apiClient';
import { listingService } from '../../services/listingService';
import {
  LISTING_SPECIES,
  LISTING_TYPES,
  LISTING_UNITS,
  type ListingSpecies,
  type ListingType,
  type ListingUnit,
  type NewListingPayload,
} from '../../types';
import { listingPath } from '../../utils/listingUrl';
import { LISTING_TYPE_SHORT, SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';

function Choice({
  value,
  current,
  onSelect,
  children,
}: {
  value: string;
  current: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        selected
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-stone-100 text-ink-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

export function PostLivestockPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [species, setSpecies] = useState<ListingSpecies>('sheep');
  const [listingType, setListingType] = useState<ListingType>('live');
  const [breed, setBreed] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<ListingUnit>('head');
  const [priceNaira, setPriceNaira] = useState('');
  const [town, setTown] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [formProblem, setFormProblem] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFormProblem('');

    if (files.length === 0) {
      setFormProblem('Add at least one photo of the livestock so buyers can see what you are selling.');
      return;
    }

    const payload: NewListingPayload = {
      title: title.trim(),
      description: description.trim(),
      species,
      listingType,
      breed: breed.trim() || undefined,
      quantity: Number(quantity),
      unit,
      priceNaira: Number(priceNaira),
      town: town.trim(),
    };

    setIsSaving(true);
    try {
      const listing = await listingService.create(payload, files);
      navigate(listingPath(listing), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err : new ApiRequestError('The listing was not saved', 'UNKNOWN')
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <Link
        to="/farmer/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-brand-700"
      >
        <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
        My dashboard
      </Link>

      <div className="mt-6 grid gap-9 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="min-w-0">
          <p className="eyebrow">Farmer tool</p>
          <h1 className="mt-3 text-balance text-3xl font-bold text-ink-900 sm:text-4xl">Post livestock for sale</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-500">
            Photos are the part buyers look at first. Give the listing one to four clear pictures of the actual stock,
            then describe the weight band, feeding and what a buyer collects.
          </p>

          <div className="mt-8 rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-8">
            {error ? (
              <div className="mb-6 space-y-3">
                <Alert tone="error" title="We could not publish that">
                  {error.message}
                </Alert>
                {error.fieldErrors.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs leading-relaxed text-red-700">
                    {error.fieldErrors.map((field) => (
                      <li key={field.field}>
                        {field.field}: {field.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {formProblem ? (
              <div className="mb-6">
                <Alert tone="error" title="One more thing">
                  {formProblem}
                </Alert>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Listing title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                error={error?.errorFor('title')}
                hint="Buyers see this first. Name the livestock and what makes it worth their money."
                placeholder="Ram for sale, healthy and vaccinated"
                maxLength={90}
                required
              />

              <Textarea
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={7}
                maxLength={2000}
                required
                error={error?.errorFor('description')}
                hint={`${description.trim().length} of 2000 characters. Say what a buyer collects, the weight band and how the stock was raised.`}
                placeholder="Two year old ram, fed on pasture and kitchen waste. Collection from my farm in Ibadan or delivery inside Oyo State."
              />

              <fieldset>
                <legend className="text-sm font-medium text-ink-700">Livestock type</legend>
                <div role="radiogroup" aria-label="Livestock type" className="mt-3 flex flex-wrap gap-2">
                  {LISTING_SPECIES.map((value) => (
                    <Choice key={value} value={value} current={species} onSelect={() => setSpecies(value)}>
                      {SPECIES_LABELS[value]}
                    </Choice>
                  ))}
                </div>
                {error?.errorFor('species') ? (
                  <p className="mt-2 text-xs font-medium text-red-600">{error.errorFor('species')}</p>
                ) : null}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-ink-700">What the buyer collects</legend>
                <div role="radiogroup" aria-label="Form" className="mt-3 flex flex-wrap gap-2">
                  {LISTING_TYPES.map((value) => (
                    <Choice key={value} value={value} current={listingType} onSelect={() => setListingType(value)}>
                      {LISTING_TYPE_SHORT[value]}
                    </Choice>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  {listingType === 'live'
                    ? 'The livestock leaves the farm on the hoof and the buyer arranges slaughter.'
                    : 'Only mark this halal processed when the slaughter was done by an authorized person and you can say so.'}
                </p>
              </fieldset>

              <div className="grid gap-6 sm:grid-cols-2">
                <Input
                  label="Breed"
                  value={breed}
                  onChange={(event) => setBreed(event.target.value)}
                  error={error?.errorFor('breed')}
                  hint="Optional. Yankasa, Balami, Cobb and so on."
                  maxLength={60}
                />
                <Input
                  label="Town or area"
                  value={town}
                  onChange={(event) => setTown(event.target.value)}
                  error={error?.errorFor('town')}
                  hint="Where the buyer collects. We show it with your state, for example Ibadan, Oyo State, Nigeria."
                  placeholder="Ibadan"
                  maxLength={60}
                  required
                />
                <Input
                  label="Quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  error={error?.errorFor('quantity')}
                  required
                />
                <div className="space-y-1.5">
                  <label htmlFor="unit" className="block text-sm font-medium text-ink-700">
                    Counted as
                  </label>
                  <select
                    id="unit"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value as ListingUnit)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm transition hover:border-stone-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
                  >
                    {LISTING_UNITS.map((value) => (
                      <option key={value} value={value}>
                        {UNIT_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-ink-500">
                    Bird for poultry, head for sheep, goat and rabbit, kilogram for processed meat.
                  </p>
                </div>
                <Input
                  label="Price in naira"
                  type="number"
                  inputMode="decimal"
                  min={100}
                  max={10000000}
                  value={priceNaira}
                  onChange={(event) => setPriceNaira(event.target.value)}
                  error={error?.errorFor('priceNaira')}
                  hint="The price for one bird, head, crate or kilogram, and what the buyer pays before delivery."
                  placeholder="180000"
                  required
                  className="sm:col-span-2"
                />
              </div>

              <PhotoPicker files={files} onChange={setFiles} error={error?.errorFor('images')} />

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Button type="submit" size="lg" isLoading={isSaving}>
                  Publish listing
                </Button>
                <p className="text-xs text-ink-500">
                  Free to list. Publishing sends it straight to the marketplace.
                </p>
              </div>
            </form>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-card bg-brand-900 p-7 text-brand-100">
            <h2 className="font-display text-lg font-semibold text-white">Photos that sell</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {[
                'Take the picture yourself, on your farm, in daylight.',
                'Show the whole livestock and one close shot of the head or body.',
                'A clean pen and no other farm branding keeps the listing honest.',
                'Up to four photos, three megabytes for the whole set, and the platform compresses them.',
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">What happens after you publish</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              The listing appears in the marketplace right away. Buyers reach the support desk about it, you agree a
              collection or delivery time, and the payment stays with the platform until the buyer confirms receipt.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              You can mark livestock sold or take a listing down from your dashboard at any time. A listing always keeps at
              least one photo, so add a replacement before removing the last one.
            </p>
            <Link to="/how-it-works" className="mt-5 inline-block">
              <Button variant="secondary" size="sm">
                Read the seller terms
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
