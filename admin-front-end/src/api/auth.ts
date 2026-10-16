/**
 * Session auth endpoints for the admin SPA (cookie-based).
 * Logout clears the cached CSRF token so the next session fetches a fresh one.
 */
import type { User } from '../types/api';
import { ApiError, api, setCsrfToken } from './client';

/**
 * Authenticate with email/password; sets the session cookie on success.
 *
 * @param email - Account email
 * @param password - Account password
 */
export async function login(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Register a new account (if signup is enabled for this deployment).
 *
 * @param email - New account email
 * @param password - New account password
 */
export async function signup(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Complete email verification using the token from the verification link.
 *
 * @param token - Verification token from the email URL
 */
export async function verifyEmail(token: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * Ask the server to resend the email-verification message for the current session.
 */
export async function resendVerification(): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/resend-verification', {
    method: 'POST',
  });
}

/**
 * End the session and clear the in-memory CSRF cache.
 * Side effect: {@link setCsrfToken}(null) so the next mutation refetches CSRF.
 */
export async function logout(): Promise<{ loggedOut: boolean }> {
  const result = await api<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' });
  // Drop stale CSRF so a new login session cannot reuse it.
  setCsrfToken(null);
  return result;
}

/**
 * Current session user, or `null` when unauthenticated (401).
 * Other errors propagate so bootstrapping can surface real outages.
 */
export async function getMe(): Promise<{ user: User } | null> {
  try {
    return await api<{ user: User }>('/api/auth/me');
  } catch (err) {
    // Treat only 401 as “logged out”; network/5xx still throw.
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
