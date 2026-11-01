import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';
import { Alert } from './common/Alert';
import { Spinner } from './common/Button';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-[50vh] place-items-center text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Alert tone="error" title="Not available for your account">
          This area is limited to{' '}
          {roles.map((role) => role + 's').join(', ')}. You are signed in as a {user.role}.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
