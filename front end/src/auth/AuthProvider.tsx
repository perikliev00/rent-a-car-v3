/**
 * Provides cookie-session auth state to the app.
 * On mount, resolves the current user via `/api/auth/me`. Login/signup/logout
 * clear the React Query cache so stale user-scoped data cannot leak across accounts.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQueryClient } from '@tanstack/react-query';
// Import '../api/auth' as the authApi namespace.
import * as authApi from '../api/auth';
// Contribute this line to the enclosing declaration or statement.
import type { User } from '../types/api';
// Import named exports from './auth-context'.
import { AuthContext } from './auth-context';

/**
 * Root auth provider; wrap the router so protected routes can read session state.
 *
 * @param props.children - App tree that should receive auth context.
 * @returns Context provider wrapping `children`.
 * @remarks Side effects: bootstraps session on mount; clears React Query cache on login/signup/logout.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Destructure array values into local variables.
  const [user, setUser] = useState<User | null>(null);
  // Destructure array values into local variables.
  const [isLoading, setIsLoading] = useState(true);
  // Create the query client constant.
  const queryClient = useQueryClient();

  /**
   * Re-fetch `/api/auth/me` and update local user state.
   * Used after email verification and for the initial bootstrap.
   */
  const refresh = useCallback(async () => {
    // Create the result constant.
    const result = await authApi.getMe();
    // `null` from getMe means anonymous — normalize to a clear logged-out state.
    setUser(result?.user ?? null);
  // Continue the surrounding logic with this statement.
  }, []);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Always clear the loading flag whether bootstrap succeeds or fails.
    refresh().finally(() => setIsLoading(false));
  // Continue the surrounding logic with this statement.
  }, [refresh]);

  /** Authenticate, store the user, and wipe any previous account's cached queries. */
  const login = async (email: string, password: string) => {
    // Destructure object properties into local variables.
    const { user: loggedIn } = await authApi.login(email, password);
    // Call setUser to perform this step.
    setUser(loggedIn);
    // Drop cached queries so the new session cannot see previous-user data.
    queryClient.clear();
    // Return the resulting value to the caller.
    return loggedIn;
  };

  /** Register, store the user, and wipe any previous account's cached queries. */
  const signup = async (email: string, password: string) => {
    // Destructure object properties into local variables.
    const { user: newUser } = await authApi.signup(email, password);
    // Call setUser to perform this step.
    setUser(newUser);
    // Call queryClient.clear to perform this step.
    queryClient.clear();
    // Return the resulting value to the caller.
    return newUser;
  };

  /** End the server session, clear local user state, and wipe cached queries. */
  const logout = async () => {
    // Wait until the asynchronous operation resolves.
    await authApi.logout();
    // Call setUser to perform this step.
    setUser(null);
    // Call queryClient.clear to perform this step.
    queryClient.clear();
  };

  // Return control to the caller with the following value.
  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
