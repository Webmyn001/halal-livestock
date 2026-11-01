import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PasswordInput } from '../../components/common/PasswordInput';
import { AuthShell } from '../../components/layout/AuthShell';
import { dashboardPath } from '../../components/layout/Navbar';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login({ identifier, password });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? dashboardPath(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not sign you in', 'UNKNOWN'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" caption="Sign in to manage your orders or your farm stock.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <Alert tone="error">
            {error.status === 401
              ? 'That email or phone number and password do not match our records.'
              : (error.fieldErrors[0]?.message ?? error.message)}
          </Alert>
        ) : null}

        <Input
          label="Email or phone number"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com"
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        New to Halal Livestocks?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:underline">
          Create a free account
        </Link>
      </p>
    </AuthShell>
  );
}
