/**
 * Gate for authenticated account routes.
 * Shows a spinner while session bootstrap runs, then redirects anonymous users
 * to `/login` while preserving `location` in router state for post-login return.
 */
import { Navigate, useLocation } from 'react-router-dom';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';
// Contribute this line to the enclosing declaration or statement.
import type { ReactNode } from 'react';

/**
 * Render `children` only when a session user exists; otherwise redirect to login.
 *
 * @param props.children - Route content that requires authentication.
 * @returns Spinner while loading, redirect when anonymous, or `children` when signed in.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  // Destructure object properties into local variables.
  const { user, isLoading } = useAuth();
  // Create the location constant.
  const location = useLocation();

  // Wait for `/api/auth/me` bootstrap before deciding to redirect.
  if (isLoading) {
    // Return control to the caller with the following value.
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!user) {
    // Preserve the intended destination so login can redirect back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
