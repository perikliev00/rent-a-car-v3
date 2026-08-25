import type { User } from '../types/api';
import { ApiError, api, setCsrfToken } from './client';

export interface AuthSessionResult {
  user: User;
  verificationRequired?: boolean;
}

export async function login(email: string, password: string): Promise<AuthSessionResult> {
  return api<AuthSessionResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(email: string, password: string): Promise<AuthSessionResult> {
  return api<AuthSessionResult>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<{ loggedOut: boolean }> {
  const result = await api<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' });
  setCsrfToken(null);
  return result;
}

export async function getMe(): Promise<AuthSessionResult | null> {
  try {
    return await api<AuthSessionResult>('/api/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

/**
 * Confirms an email address. The raw token comes straight from the emailed link and is
 * never written to storage or analytics.
 */
export async function verifyEmail(
  token: string,
): Promise<{ emailVerified: boolean; alreadyVerified: boolean }> {
  return api<{ emailVerified: boolean; alreadyVerified: boolean }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(): Promise<{
  requested: boolean;
  emailVerified: boolean;
}> {
  return api<{ requested: boolean; emailVerified: boolean }>('/api/auth/verify-email/resend', {
    method: 'POST',
  });
}
