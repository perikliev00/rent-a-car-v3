import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { isStaffUser } from './permissions';
import type { ReactNode } from 'react';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isStaffUser(user)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-[var(--color-ink)]">Access Denied</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          You do not have permission to access the admin panel.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
