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
