import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { PasswordInput } from '../../components/common/PasswordInput';
import { AuthShell } from '../../components/layout/AuthShell';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';

export function ResetPasswordPage() {
  const { logout } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLocalError('');

    if (!token) {
      setLocalError('This page needs the reset link from your email.');
      return;
    }
    if (password !== confirm) {
      setLocalError('The two passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      // The reset ends every session issued before it, including this browser's stored token.
      logout();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not change your password', 'UNKNOWN'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password changed" caption="You can sign in with your new password right away.">
        <Alert tone="success" title="Done">
          Every device that was signed in before this change has been signed out. If that was not you, contact the
          support team now.
        </Alert>
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-700"
        >
          Sign in
        </Link>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title="Set a new password"
        caption="This page only works from the link we emailed you."
      >
        <Alert tone="error" title="No reset link found">
          The link may have been cut off by your email app. Request a new one and open it in this browser.
        </Alert>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-700"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" caption="Choose something you have not used on this account before.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && error.fieldErrors.length === 0 ? <Alert tone="error">{error.message}</Alert> : null}
        {localError ? <Alert tone="error">{localError}</Alert> : null}

        <PasswordInput
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with a letter and a number."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.errorFor('password')}
        />
        <PasswordInput
          label="Confirm new password"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Change password
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Link expired?{' '}
        <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          Start over
        </Link>
      </p>
    </AuthShell>
  );
}
