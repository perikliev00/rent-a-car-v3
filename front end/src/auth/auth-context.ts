import { createContext } from 'react';
import type { User } from '../types/api';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  /** True only when a user is signed in and their email address is confirmed. */
  emailVerified: boolean;
  /** True when a user is signed in but still needs to confirm their email address. */
  verificationRequired: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
