import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { AuthShell } from '../../components/layout/AuthShell';
import { dashboardPath } from '../../components/layout/Navbar';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';

type Stage = 'checking' | 'verified' | 'failed' | 'ask';

export function VerifyEmailPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [stage, setStage] = useState<Stage>(token ? 'checking' : 'ask');
  const [failure, setFailure] = useState('');
  const [identifier, setIdentifier] = useState(user?.email ?? '');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSending, setIsSending] = useState(false);

  // StrictMode mounts the effect twice in development and the link is single use, so the
  // second pass must not hit the API or a fresh link looks broken.
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!token || attempted.current === token) return;
    attempted.current = token;

    authService
      .verifyEmail(token)
      .then(async () => {
        await refresh();
        setStage('verified');
      })
      .catch((err: unknown) => {
        setFailure(err instanceof ApiRequestError ? err.message : 'We could not check that link.');
        setStage('failed');
      });
  }, [token, refresh]);

  async function handleResend(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSending(true);
    try {
      await authService.resendVerification(identifier);
      setStage('ask');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not send a new link', 'UNKNOWN'));
    } finally {
      setIsSending(false);
    }
  }

  if (stage === 'checking') {
    return (
      <AuthShell title="Confirming your email" caption="One moment while we check the link you opened.">
        <div className="flex items-center gap-3 text-brand-600">
          <Spinner className="size-6" />
          <span className="text-sm">Working on it</span>
        </div>
      </AuthShell>
    );
  }

  if (stage === 'verified') {
    return (
      <AuthShell title="Email confirmed" caption="Your address is verified and your account is fully active.">
        <Alert tone="success" title="You are all set">
          A confirmed address is what the verified badge is built on, and it lets us reach you about orders.
        </Alert>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => navigate(user ? dashboardPath(user.role) : '/login', { replace: true })}
        >
          {user ? 'Go to my dashboard' : 'Sign in'}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Confirm your email"
      caption="We sent a confirmation link to your address. Open it to finish setting up your account."
    >
      {stage === 'failed' ? (
        <Alert tone="error" title="That link did not work">
          {failure} Links expire after 24 hours and can be used once, so ask for a new one below.
        </Alert>
      ) : null}

      <form onSubmit={handleResend} className="mt-6 space-y-5">
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

        <Button type="submit" size="lg" className="w-full" isLoading={isSending}>
          Send me a new link
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Did not get the email?{' '}
        <Link to="/contact" className="font-semibold text-brand-700 hover:underline">
          Tell the support team
        </Link>
      </p>
    </AuthShell>
  );
}
