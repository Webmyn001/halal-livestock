import { useState, type FormEvent } from 'react';
import { Alert } from '../common/Alert';
import { Button, Spinner } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';

export function VerificationCard() {
  const { user, refresh } = useAuth();

  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState<'email' | 'send' | 'confirm' | null>(null);

  if (!user) return null;

  const accountEmail = user.email;

  if (user.isEmailVerified && user.isPhoneVerified) {
    return (
      <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
        <h2 className="font-display text-lg font-semibold text-ink-900">Account checks</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Your email and phone number are both confirmed. That is what lets buyers reach a real person before an order
          is placed.
        </p>
      </section>
    );
  }

  async function handleResendEmail() {
    setError('');
    setBusy('email');
    try {
      await authService.resendVerification(accountEmail);
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send the confirmation email.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendCode() {
    setError('');
    setBusy('send');
    try {
      await authService.sendPhoneCode();
      setCodeSent(true);
      setEmailSent(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send a code.');
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy('confirm');
    try {
      await authService.confirmPhone(code);
      await refresh();
      setCode('');
      setCodeSent(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That code was not accepted.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <h2 className="font-display text-lg font-semibold text-ink-900">Finish your account checks</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
        Two confirmations, both free, and both take under a minute.
      </p>

      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900">Email address</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          {user.isEmailVerified ? (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
              Confirmed
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={handleResendEmail} isLoading={busy === 'email'}>
              {emailSent ? 'Send again' : 'Send link'}
            </Button>
          )}
        </div>

        {emailSent && !user.isEmailVerified ? (
          <p className="text-xs leading-relaxed text-ink-500">
            A new link is on its way. It works once and expires after 24 hours. Check promotions and junk if it does
            not land within a few minutes.
          </p>
        ) : null}

        {!user.isPhoneVerified ? (
          <div className="rounded-xl border border-stone-200 px-4 py-3.5">
            <p className="text-sm font-medium text-ink-900">Phone number</p>
            <p className="mt-0.5 text-xs text-ink-500">{user.phoneNumber}</p>

            {codeSent ? (
              <form onSubmit={handleConfirm} className="mt-3.5 space-y-3">
                <Input
                  label="Six digit code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  hint="We emailed the code to the address on your account. It expires in 10 minutes."
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="font-mono tracking-[0.3em]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" isLoading={busy === 'confirm'}>
                    Confirm number
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSendCode}
                    isLoading={busy === 'send'}
                  >
                    Send a new code
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-3.5 flex items-center gap-3">
                <Button size="sm" onClick={handleSendCode} isLoading={busy === 'send'}>
                  Send code by email
                </Button>
                {busy === 'send' ? <Spinner className="size-4 text-brand-600" /> : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
