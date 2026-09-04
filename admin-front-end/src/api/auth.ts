import type { User } from '../types/api';
import { ApiError, api, setCsrfToken } from './client';

export async function login(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(email: string, password: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyEmail(token: string): Promise<{ user: User }> {
  return api<{ user: User }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/resend-verification', {
    method: 'POST',
  });
}

export async function logout(): Promise<{ loggedOut: boolean }> {
  const result = await api<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' });
  setCsrfToken(null);
  return result;
}

export async function getMe(): Promise<{ user: User } | null> {
  try {
    return await api<{ user: User }>('/api/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
