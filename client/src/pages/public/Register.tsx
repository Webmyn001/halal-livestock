import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PasswordInput } from '../../components/common/PasswordInput';
import { AuthShell } from '../../components/layout/AuthShell';
import { dashboardPath } from '../../components/layout/Navbar';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import type { UserRole } from '../../types';

type AccountRole = Extract<UserRole, 'buyer' | 'farmer'>;

const ROLE_COPY: Record<AccountRole, { label: string; blurb: string }> = {
  buyer: {
    label: 'I am buying',
    blurb: 'Wholesalers, butchers, restaurants, caterers and households.',
  },
  farmer: {
    label: 'I am a farmer',
    blurb: 'Raising rabbits, poultry or sheep near Ibadan.',
  },
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<AccountRole>('buyer');
  const [values, setValues] = useState({ fullName: '', email: '', phoneNumber: '', password: '' });
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await register({ ...values, role });
      navigate(dashboardPath(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not create your account', 'UNKNOWN'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      caption="Free to register, free to list and free to message. We earn only when an order completes."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && error.fieldErrors.length === 0 ? <Alert tone="error">{error.message}</Alert> : null}

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">Account type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLE_COPY) as AccountRole[]).map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  role === option
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-stone-300 bg-white hover:border-stone-400'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-ink-900">{ROLE_COPY[option].label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-500">{ROLE_COPY[option].blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
          value={values.fullName}
          onChange={update('fullName')}
          error={error?.errorFor('fullName')}
        />
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          hint="We send a confirmation link as soon as you sign up."
          value={values.email}
          onChange={update('email')}
          error={error?.errorFor('email')}
        />
        <Input
          label="Phone number"
          name="phoneNumber"
          type="tel"
          autoComplete="tel"
          required
          hint="Nigerian numbers work as 0803 or +234803"
          value={values.phoneNumber}
          onChange={update('phoneNumber')}
          error={error?.errorFor('phoneNumber')}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with a letter and a number."
          value={values.password}
          onChange={update('password')}
          error={error?.errorFor('password')}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Create {role} account
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
