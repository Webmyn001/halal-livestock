import { useState, type FormEvent } from 'react';
import { Alert } from '../components/common/Alert';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { ApiRequestError } from '../services/apiClient';
import { authService } from '../services/authService';

const NEXT_UP: Record<string, { title: string; caption: string; items: string[] }> = {
  farmer: {
    title: 'Farmer dashboard',
    caption: 'Verify your farm, then start listing stock.',
    items: [
      'Submit an identity document plus photos or video of your farm to earn the verified badge.',
      'Add a NUBAN bank account in your own name so payouts can reach you.',
      'Create listings for live animals and for halal processed products separately.',
    ],
  },
  buyer: {
    title: 'Buyer dashboard',
    caption: 'Browse farms around Ibadan and place your first order.',
    items: [
      'Search by rabbit, poultry or sheep and filter by town.',
      'Reserve stock and pay through Paystack when checkout opens.',
      'Inspect the delivery, then share your confirmation code to release payment.',
    ],
  },
  admin: {
    title: 'Admin control centre',
    caption: 'Review verification queues, disputes and platform settings.',
    items: [
      'Approve or reject farmer verification submissions.',
      'Adjudicate disputes and issue refunds.',
      'Set the commission rate, the dispute window and the allowed towns.',
    ],
  },
};

export function DashboardPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const plan = NEXT_UP[user.role] ?? NEXT_UP.buyer!;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    setIsSaving(true);
    try {
      await authService.updateProfile({ fullName });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not save', 'UNKNOWN'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-shell grid gap-10 py-14 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="eyebrow">{user.role} account</p>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">{plan.title}</h1>
        <p className="mt-2 text-ink-500">{plan.caption}</p>

        <section className="mt-9 rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card">
          <h2 className="text-lg font-semibold text-ink-900">Your next steps</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-700">
            {plan.items.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card">
          <h2 className="text-lg font-semibold text-ink-900">Profile details</h2>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {error ? <Alert tone="error">{error.errorFor('fullName') ?? error.message}</Alert> : null}
            {saved ? <Alert tone="success">Your profile was updated.</Alert> : null}
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Button type="submit" isLoading={isSaving}>
              Save changes
            </Button>
          </form>
        </section>
      </div>

      <aside className="space-y-6">
        <div className="rounded-card bg-brand-900 p-7 text-brand-100">
          <h2 className="font-display text-lg font-semibold text-white">Account status</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Row label="Signed in as" value={user.email} />
            <Row label="Phone" value={user.phoneNumber} />
            <Row label="Account" value={user.isActive ? 'Active' : 'Suspended'} />
            <Row label="Email verified" value={user.isEmailVerified ? 'Yes' : 'Not yet'} />
            <Row label="Phone verified" value={user.isPhoneVerified ? 'Yes' : 'Not yet'} />
          </dl>
        </div>

        <div className="rounded-card bg-stone-50 p-7 ring-1 ring-stone-200">
          <h2 className="font-display text-base font-semibold text-ink-900">Nothing is charged yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Orders, payments and delivery tracking arrive in the coming builds. Registration, listings and messages stay
            free, and the platform only earns a commission on completed orders.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-brand-200">{label}</dt>
      <dd className="truncate font-medium text-white">{value}</dd>
    </div>
  );
}
