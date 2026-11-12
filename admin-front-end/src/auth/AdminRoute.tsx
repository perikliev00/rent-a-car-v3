/**
 * Route guard for the admin shell: waits for session load, redirects guests
 * to login, and logs out non-staff accounts that somehow hold a session cookie.
 */
import { Navigate } from 'react-router-dom';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';
// Import named exports from './permissions'.
import { isStaffUser } from './permissions';
// Import named exports from 'react'.
import { useEffect, useState, type ReactNode } from 'react';

/** Static “no admin access” screen after a non-staff session is cleared. */
function AccessDenied() {
  // Return control to the caller with the following value.
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--color-ink)]">Access Denied</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        You do not have permission to access the admin panel.
      </p>
    </div>
  );
}

/**
 * Wraps admin pages; non-staff sessions are cleared then shown Access Denied.
 * @param children - Admin route tree to render when staff is authenticated
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  // Destructure object properties into local variables.
  const { user, isLoading, logout } = useAuth();
  // Destructure array values into local variables.
  const [denied, setDenied] = useState(false);

  // Logout once so a customer cookie cannot linger after hitting /admin.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!isLoading && user && !isStaffUser(user) && !denied) {
      // Call setDenied to perform this step.
      setDenied(true);
      // Continue the surrounding logic with this statement.
      void logout();
    }
  // Continue the surrounding logic with this statement.
  }, [denied, isLoading, logout, user]);

  // Session bootstrap still in flight — show spinner instead of flashing login.
  if (isLoading) {
    // Return control to the caller with the following value.
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  // Non-staff path: keep Access Denied after logout completes.
  if (denied) {
    return <AccessDenied />;
  }

  // Guests go to login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Defense in depth if effect has not yet flipped `denied`.
  if (!isStaffUser(user)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
