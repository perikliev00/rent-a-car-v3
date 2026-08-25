import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import type { User } from '../types/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    const result = await authApi.getMe();
    setUser(result?.user ?? null);
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

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

  const emailVerified = user ? user.emailVerified !== false : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        emailVerified,
        verificationRequired: Boolean(user) && !emailVerified,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
