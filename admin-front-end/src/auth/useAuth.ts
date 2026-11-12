/** Access the admin auth context; throws outside {@link AuthProvider}. */
import { useContext } from 'react';
// Import named exports from './auth-context'.
import { AuthContext } from './auth-context';

/**
 * Read the current {@link AuthContext} value.
 * Throws if called outside {@link AuthProvider} so misuse fails fast in development.
 */
export function useAuth() {
  // Create the ctx constant.
  const ctx = useContext(AuthContext);
  // Guard: hooks using auth must be under the provider tree.
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  // Return the resulting value to the caller.
  return ctx;
}
