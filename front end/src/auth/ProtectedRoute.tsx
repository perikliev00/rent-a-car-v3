/**
 * Gate for authenticated account routes.
 * Shows a spinner while session bootstrap runs, then redirects anonymous users
 * to `/login` while preserving `location` in router state for post-login return.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { ReactNode } from 'react';

/**
 * Render `children` only when a session user exists; otherwise redirect to login.
 *
 * @param props.children - Route content that requires authentication.
 * @returns Spinner while loading, redirect when anonymous, or `children` when signed in.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Wait for `/api/auth/me` bootstrap before deciding to redirect.
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (!user) {
    // Preserve the intended destination so login can redirect back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
