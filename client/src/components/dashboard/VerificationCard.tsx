import { useState } from 'react';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';

export function VerificationCard() {
  const { user } = useAuth();

  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const accountEmail = user.email;

  if (user.isEmailVerified) {
    return (
      <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
        <h2 className="font-display text-lg font-semibold text-ink-900">Account checks</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Your email address is confirmed. The review team checks the phone number you gave when they assess your farm
          details.
        </p>
      </section>
    );
  }

  async function handleResendEmail() {
    setError('');
    setBusy(true);
    try {
      await authService.resendVerification(accountEmail);
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send the confirmation email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <h2 className="font-display text-lg font-semibold text-ink-900">Confirm your email address</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
        The link is free, works once, and takes under a minute. You need it before you can send your farm details for
        review.
      </p>

      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Email address</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleResendEmail} isLoading={busy}>
          {emailSent ? 'Send again' : 'Send link'}
        </Button>
      </div>

      {emailSent ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          A new link is on its way. It works once and expires after 24 hours. Check promotions and junk if it does not
          land within a few minutes.
        </p>
      ) : null}
    </section>
  );
}
