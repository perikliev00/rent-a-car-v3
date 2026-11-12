/**
 * Auth API wrappers for cookie-based sessions.
 * Login/signup establish the session; {@link getMe} treats 401 as “logged out”
 * so bootstrap can finish without surfacing an error toast.
 */
import type { User } from '../types/api';
import { ApiError, api, setCsrfToken } from './client';

/**
 * Authenticate and create a session cookie.
 *
 * @param email - Account email.
 * @param password - Account password.
 * @returns Signed-in user payload from the API envelope.
 * @remarks Side effect: server sets the session cookie; CSRF may be embedded in the response.
 */
export async function login(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Register a new customer account and start a session.
 *
 * @param email - Desired account email.
 * @param password - Desired account password.
 * @returns Newly created signed-in user.
 * @remarks Side effect: server creates the account and sets the session cookie.
 */
export async function signup(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Confirm email ownership using the one-time token from the verification email.
 *
 * @param token - Verification token from the email link.
 * @returns Updated user (typically with `emailVerified` set).
 */
export async function verifyEmail(token: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * Ask the backend to send another verification email for the current user.
 *
 * @returns Whether the email was accepted for sending.
 * @remarks Side effect: triggers an outbound email when rate limits allow.
 */
export async function resendVerification(): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/resend-verification', {
    method: 'POST',
  });
}

/**
 * End the server session and clear the cached CSRF token.
 *
 * @returns Confirmation that the session was logged out.
 * @remarks Side effect: clears the in-memory CSRF token so the next login cannot reuse a prior-session token.
 */
export async function logout(): Promise<{ loggedOut: boolean }> {
  const result = await api<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' });
  // Drop any CSRF bound to the session we just ended.
  setCsrfToken(null);
  return result;
}

/**
 * Resolve the current session user.
 *
 * @returns The signed-in user, or `null` when there is no session (HTTP 401).
 * @throws Re-throws non-401 {@link ApiError}s and unexpected failures for callers to handle.
 */
export async function getMe(): Promise<{ user: User } | null> {
  try {
    return await api<{ user: User }>('/api/auth/me');
  } catch (err) {
    // 401 means “anonymous” during bootstrap — not an actionable failure.
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
