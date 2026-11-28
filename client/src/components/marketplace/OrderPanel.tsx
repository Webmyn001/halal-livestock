import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import { orderService } from '../../services/orderService';
import type { Listing } from '../../types';
import { formatNaira } from '../../utils/format';
import { UNIT_LABELS } from '../../utils/listingMeta';

interface OrderPanelProps {
  listing: Listing;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OrderPanel({ listing }: OrderPanelProps) {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState('1');
  const [contactName, setContactName] = useState(user?.fullName ?? '');
  const [contactPhone, setContactPhone] = useState(user?.phoneNumber ?? '');
  const [address, setAddress] = useState('');
  const [town, setTown] = useState(listing.town);
  const [state, setState] = useState(listing.state);
  const [wantedDate, setWantedDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const units = Number(quantity) || 0;
  const canSell = listing.status === 'active' && listing.quantity > 0;

  // ── Sold / under process / unavailable: show a bold block, no order form ──────────────────
  if (!canSell) {
    const isSold = listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0);
    const isUnderProcess = listing.status === 'under_process';

    return (
      <div
        className={`rounded-2xl ring-2 overflow-hidden shadow-sm ${
          isSold
            ? 'bg-red-50 ring-red-400'
            : isUnderProcess
              ? 'bg-amber-50 ring-amber-400'
              : 'bg-stone-100 ring-stone-300'
        }`}
      >
        <div
          className={`py-3.5 text-center font-black tracking-widest uppercase text-white ${
            isSold ? 'bg-red-600' : isUnderProcess ? 'bg-amber-600' : 'bg-stone-700'
          }`}
        >
          <p className="text-base">
            {isSold ? '🔴 SOLD' : isUnderProcess ? '⏳ UNDER PROCESS' : '🚫 UNAVAILABLE'}
          </p>
        </div>
        <div className="px-5 py-5 text-center space-y-2">
          <p className="text-sm font-bold text-ink-900">
            {isSold
              ? 'This item has already been sold.'
              : isUnderProcess
                ? 'An order is in progress for this item.'
                : 'This listing is currently unavailable.'}
          </p>
          <p className="text-xs text-ink-600 leading-relaxed">
            {isSold
              ? 'Another buyer has already purchased this livestock. It is no longer available for new orders.'
              : isUnderProcess
                ? 'This livestock is currently being processed with another buyer. Other buyers cannot purchase it.'
                : 'This item is not accepting new orders.'}
          </p>
          <div className="pt-2">
            <Link
              to="/marketplace"
              className="inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-800 shadow transition"
            >
              Find other available livestock
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (status !== 'authenticated' || !user) {
    return (
      <div className="space-y-3">
        <Link to="/login" className="block">
          <Button size="lg" className="w-full">
            Sign in to order
          </Button>
        </Link>
        <p className="text-xs leading-relaxed text-ink-500">
          Every order is placed from an account so the payment can be traced back to you.
        </p>
      </div>
    );
  }

  // ── Wrong role ─────────────────────────────────────────────────────────────
  if (user.role !== 'buyer') {
    return (
      <Alert tone="info" title={user.role === 'farmer' ? 'Farms buy with a buyer account' : 'Staff accounts do not order'}>
        {user.role === 'farmer'
          ? 'Your account sells stock. Register a buyer account to purchase from another farm.'
          : 'You are signed in with a staff account. Open a buyer account to place an order.'}
      </Alert>
    );
  }

  // ── Order form ─────────────────────────────────────────────────────────────
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const order = await orderService.create({
        listingId: listing.id,
        quantity: units,
        contactName,
        contactPhone,
        address,
        town,
        state,
        wantedDate: wantedDate || undefined,
        note: note || undefined,
      });
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err);
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((entry) => [entry.field, entry.message])));
      } else {
        setError(new ApiRequestError('That order could not be placed', 'UNKNOWN'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <Alert tone="error" title="We could not place that order">
          {error.message}
        </Alert>
      ) : null}

      <div className="flex items-end gap-3">
        <Input
          label="How many"
          type="number"
          inputMode="numeric"
          min={1}
          max={listing.quantity}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={fieldErrors.quantity}
          className="w-32"
        />
        <p className="pb-3 text-sm text-ink-600">
          {UNIT_LABELS[listing.unit]} · {listing.quantity} available
        </p>
      </div>

      <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
        <div className="flex items-baseline justify-between text-sm text-ink-700">
          <span>{formatNaira(listing.priceKobo)} × {units || 0}</span>
          <span className="font-semibold text-ink-900">
            {units > 0 ? formatNaira(listing.priceKobo * units) : 'Choose a quantity'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Delivery is arranged directly with the farmer. Your payment is held safely by Halal Livestocks until you confirm you received the livestock.
        </p>
      </div>

      <Input
        label="Who receives the livestock"
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        error={fieldErrors.contactName}
        autoComplete="name"
      />
      <Input
        label="Contact phone number"
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
        error={fieldErrors.contactPhone}
        inputMode="tel"
        placeholder="08031234567"
        hint="The farmer will call this number to arrange delivery."
      />
      <Input
        label="Delivery address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        error={fieldErrors.address}
        hint="Street, area, and a landmark the farmer can find."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Town" value={town} onChange={(event) => setTown(event.target.value)} error={fieldErrors.town} />
        <Input label="State" value={state} onChange={(event) => setState(event.target.value)} error={fieldErrors.state} />
      </div>
      <Input
        label="Preferred delivery date (optional)"
        type="date"
        min={today()}
        value={wantedDate}
        onChange={(event) => setWantedDate(event.target.value)}
        error={fieldErrors.wantedDate}
      />
      <Textarea
        label="Note for the farmer (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={fieldErrors.note}
        rows={3}
        placeholder="Weights needed, delivery time, how the stock should be packed or crated."
      />

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || units < 1}>
        {isSubmitting ? 'Placing the order…' : 'Place order and pay'}
      </Button>
      <p className="text-center text-xs text-ink-500">
        You choose the payment method on the next page. Nothing leaves your account until you do.
      </p>
    </form>
  );
}
