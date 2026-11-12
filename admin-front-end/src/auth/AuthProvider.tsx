/**
 * Boots the admin session from `/api/auth/me` and clears React Query caches
 * on login/signup/logout so role-scoped data cannot leak across users.
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
 * Provides session state and auth actions to the admin tree.
 * @param children - App content that may call {@link useAuth}
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Destructure array values into local variables.
  const [user, setUser] = useState<User | null>(null);
  // Destructure array values into local variables.
  const [isLoading, setIsLoading] = useState(true);
  // Create the query client constant.
  const queryClient = useQueryClient();

  /** Re-fetch `/me` and update `user` (null when unauthenticated). */
  const refresh = useCallback(async () => {
    // Create the result constant.
    const result = await authApi.getMe();
    // Call setUser to perform this step.
    setUser(result?.user ?? null);
  // Continue the surrounding logic with this statement.
  }, []);

  // Initial bootstrap: load session then clear the loading gate.
  useEffect(() => {
    // Call refresh to perform this step.
    refresh().finally(() => setIsLoading(false));
  // Continue the surrounding logic with this statement.
  }, [refresh]);

  // Clear cached queries so the new principal never sees the previous user's data.
  const login = async (email: string, password: string) => {
    // Destructure object properties into local variables.
    const { user: loggedIn } = await authApi.login(email, password);
    // Call setUser to perform this step.
    setUser(loggedIn);
    // Call queryClient.clear to perform this step.
    queryClient.clear();
    // Return the resulting value to the caller.
    return loggedIn;
  };

  // Create the signup constant.
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

  // Create the logout constant.
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
