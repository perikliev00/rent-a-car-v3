/**
 * Provides cookie-session auth state to the app.
 * On mount, resolves the current user via `/api/auth/me`. Login/signup/logout
 * clear the React Query cache so stale user-scoped data cannot leak across accounts.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import type { User } from '../types/api';
import { AuthContext } from './auth-context';

/**
 * Root auth provider; wrap the router so protected routes can read session state.
 *
 * @param props.children - App tree that should receive auth context.
 * @returns Context provider wrapping `children`.
 * @remarks Side effects: bootstraps session on mount; clears React Query cache on login/signup/logout.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  /**
   * Re-fetch `/api/auth/me` and update local user state.
   * Used after email verification and for the initial bootstrap.
   */
  const refresh = useCallback(async () => {
    const result = await authApi.getMe();
    // `null` from getMe means anonymous — normalize to a clear logged-out state.
    setUser(result?.user ?? null);
  }, []);

  useEffect(() => {
    // Always clear the loading flag whether bootstrap succeeds or fails.
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  /** Authenticate, store the user, and wipe any previous account's cached queries. */
  const login = async (email: string, password: string) => {
    const { user: loggedIn } = await authApi.login(email, password);
    setUser(loggedIn);
    // Drop cached queries so the new session cannot see previous-user data.
    queryClient.clear();
    return loggedIn;
  };

  /** Register, store the user, and wipe any previous account's cached queries. */
  const signup = async (email: string, password: string) => {
    const { user: newUser } = await authApi.signup(email, password);
    setUser(newUser);
    queryClient.clear();
    return newUser;
  };

  /** End the server session, clear local user state, and wipe cached queries. */
  const logout = async () => {
    await authApi.logout();
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
