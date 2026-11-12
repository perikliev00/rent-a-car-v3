/**
 * React context shape for session state.
 * Kept in a separate module from {@link AuthProvider} so hooks can import the
 * context without creating a circular dependency with the provider component.
 */
import { createContext } from 'react';
// Contribute this line to the enclosing declaration or statement.
import type { User } from '../types/api';

/** Session value exposed to the tree via {@link AuthContext}. */
export interface AuthContextValue {
  // Provide the user field value.
  user: User | null;
  /** True until the initial `/api/auth/me` bootstrap finishes. */
  isLoading: boolean;
  // Provide the login field value.
  login: (email: string, password: string) => Promise<User>;
  // Provide the signup field value.
  signup: (email: string, password: string) => Promise<User>;
  // Provide the logout field value.
  logout: () => Promise<void>;
  /** Re-fetch the current user (e.g. after email verification). */
  refresh: () => Promise<void>;
}

/**
 * Auth session context. Defaults to `null` so {@link useAuth} can detect a missing provider.
 *
 * @returns A React context whose default value is `null` until {@link AuthProvider} mounts.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
