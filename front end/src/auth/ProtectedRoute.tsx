import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Account pages that read historical booking data require a confirmed email address.
   * The API enforces this too (403 EMAIL_VERIFICATION_REQUIRED); this only keeps the UI
   * from rendering a page that would fail.
   */
  requireVerifiedEmail?: boolean;
}

export function ProtectedRoute({ children, requireVerifiedEmail }: ProtectedRouteProps) {
  const { user, isLoading, emailVerified } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireVerifiedEmail && !emailVerified) {
    return <Navigate to="/account/verify-email" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
