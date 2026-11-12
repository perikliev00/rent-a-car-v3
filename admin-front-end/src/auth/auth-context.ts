/**
 * React context contract for admin session state.
 * Separated from the provider so hooks can import without a circular dependency.
 */
import { createContext } from 'react';
// Contribute this line to the enclosing declaration or statement.
import type { User } from '../types/api';

// Export the auth context value interface.
export interface AuthContextValue {
  // Provide the user field value.
  user: User | null;
  // Provide the is loading field value.
  isLoading: boolean;
  // Provide the login field value.
  login: (email: string, password: string) => Promise<User>;
  // Provide the signup field value.
  signup: (email: string, password: string) => Promise<User>;
  // Provide the logout field value.
  logout: () => Promise<void>;
  // Provide the refresh field value.
  refresh: () => Promise<void>;
}

// Export the auth context const.
export const AuthContext = createContext<AuthContextValue | null>(null);
