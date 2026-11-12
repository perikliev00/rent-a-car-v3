/**
 * Convenience hook for reading {@link AuthContext}.
 * Throws if used outside {@link AuthProvider} so missing providers fail fast in development.
 */
import { useContext } from 'react';
import { AuthContext } from './auth-context';

/**
 * Access the current session user and login/signup/logout/refresh helpers.
 *
 * @returns The non-null {@link AuthContextValue} from the nearest provider.
 * @throws When called outside {@link AuthProvider}.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  // Fail fast so pages do not silently treat a missing provider as “logged out”.
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
