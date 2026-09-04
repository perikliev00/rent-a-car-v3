import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { isStaffUser } from './permissions';
import { useEffect, useState, type ReactNode } from 'react';

function AccessDenied() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--color-ink)]">Access Denied</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        You do not have permission to access the admin panel.
      </p>
    </div>
  );
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !isStaffUser(user) && !denied) {
      setDenied(true);
      void logout();
    }
  }, [denied, isLoading, logout, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (denied) {
    return <AccessDenied />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isStaffUser(user)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
