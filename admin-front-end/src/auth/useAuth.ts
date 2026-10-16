/** Access the admin auth context; throws outside {@link AuthProvider}. */
import { useContext } from 'react';
import { AuthContext } from './auth-context';

/**
 * Read the current {@link AuthContext} value.
 * Throws if called outside {@link AuthProvider} so misuse fails fast in development.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  // Guard: hooks using auth must be under the provider tree.
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
