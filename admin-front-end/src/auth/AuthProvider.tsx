/**
 * Boots the admin session from `/api/auth/me` and clears React Query caches
 * on login/signup/logout so role-scoped data cannot leak across users.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import type { User } from '../types/api';
import { AuthContext } from './auth-context';

/**
 * Provides session state and auth actions to the admin tree.
 * @param children - App content that may call {@link useAuth}
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  /** Re-fetch `/me` and update `user` (null when unauthenticated). */
  const refresh = useCallback(async () => {
    const result = await authApi.getMe();
    setUser(result?.user ?? null);
  }, []);

  // Initial bootstrap: load session then clear the loading gate.
  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Clear cached queries so the new principal never sees the previous user's data.
  const login = async (email: string, password: string) => {
    const { user: loggedIn } = await authApi.login(email, password);
    setUser(loggedIn);
    queryClient.clear();
    return loggedIn;
  };

  const signup = async (email: string, password: string) => {
    const { user: newUser } = await authApi.signup(email, password);
    setUser(newUser);
    queryClient.clear();
    return newUser;
  };

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
