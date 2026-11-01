import { useState, type FormEvent } from 'react';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import { formatDate } from '../../utils/format';

const ROLE_LABELS = { buyer: 'Buyer', farmer: 'Farmer', admin: 'Administrator' };

export function AccountPanel() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({ fullName, phoneNumber });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not save', 'UNKNOWN'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-card bg-brand-900 p-6 text-brand-100 sm:p-7">
        <h2 className="font-display text-lg font-semibold text-white">Account status</h2>
        <dl className="mt-5 space-y-3.5 text-sm">
          <Row label="Signed in as" value={user.email} />
          <Row label="Phone" value={user.phoneNumber} />
          <Row label="Role" value={ROLE_LABELS[user.role]} />
          <Row label="Email verified" value={user.isEmailVerified ? 'Yes' : 'Not yet'} />
          <Row label="Phone verified" value={user.isPhoneVerified ? 'Yes' : 'Not yet'} />
          <Row label="Joined" value={formatDate(user.createdAt)} />
        </dl>
      </div>

      <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
        <h2 className="font-display text-lg font-semibold text-ink-900">Profile details</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          Farmers and buyers see this name on every listing and message.
        </p>
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {error ? (
            <Alert tone="error">{error.errorFor('fullName') ?? error.errorFor('phoneNumber') ?? error.message}</Alert>
          ) : null}
          {saved ? <Alert tone="success">Your profile was updated.</Alert> : null}
          <Input
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={error?.errorFor('fullName')}
            autoComplete="name"
            required
          />
          <Input
            label="Phone number"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            error={error?.errorFor('phoneNumber')}
            autoComplete="tel"
            hint="Nigerian numbers are saved in the +234 form."
            required
          />
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-brand-200">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-white">{value}</dd>
    </div>
  );
}
