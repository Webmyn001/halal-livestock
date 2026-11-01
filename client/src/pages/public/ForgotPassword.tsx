import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { AuthShell } from '../../components/layout/AuthShell';
import { authService } from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(identifier);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not start the reset', 'UNKNOWN'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        caption="If that address or number matches an account, a reset link is on its way."
      >
        <Alert tone="success" title="Request received">
          The link is valid for 30 minutes and can be opened once. Nothing happens if you ignore it.
        </Alert>
        <ul className="mt-6 space-y-2 text-sm leading-relaxed text-ink-500">
          <li>Messages can sit in the promotions or junk folder for a few minutes.</li>
          <li>Use the same address you signed up with.</li>
          <li>Still waiting? Send this request again, and the older link stops working.</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setSent(false)}>
            Request another link
          </Button>
          <Link
            to="/login"
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      caption="Tell us the email or phone number on your account and we will send a link to set a new password."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && error.fieldErrors.length === 0 ? <Alert tone="error">{error.message}</Alert> : null}

        <Input
          label="Email or phone number"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={error?.errorFor('identifier')}
          placeholder="you@example.com"
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
