import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();
const mockSetCsrfToken = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  setCsrfToken: (...args: unknown[]) => mockSetCsrfToken(...args),
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import { ApiError } from './client';
import { getMe, login, logout, resendVerification, signup, verifyEmail } from './auth';

describe('auth API', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockSetCsrfToken.mockReset();
  });

  it('login posts credentials to /api/auth/login', async () => {
    const user = { id: '1', email: 'a@b.com', role: 'user' as const };
    mockApi.mockResolvedValue({ user });

    const result = await login('a@b.com', 'secret');

    expect(mockApi).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
    });
    expect(result).toEqual({ user });
  });

  it('signup posts credentials to /api/auth/signup', async () => {
    const user = { id: '2', email: 'new@b.com', role: 'user' as const };
    mockApi.mockResolvedValue({ user });

    await signup('new@b.com', 'pass123');

    expect(mockApi).toHaveBeenCalledWith('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@b.com', password: 'pass123' }),
    });
  });

  it('logout clears CSRF token after POST', async () => {
    mockApi.mockResolvedValue({ loggedOut: true });

    const result = await logout();

    expect(mockApi).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(mockSetCsrfToken).toHaveBeenCalledWith(null);
    expect(result).toEqual({ loggedOut: true });
  });

  it('getMe returns null on 401 and rethrows other errors', async () => {
    mockApi.mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'Please log in', 401));
    await expect(getMe()).resolves.toBeNull();

    mockApi.mockRejectedValueOnce(new ApiError('SERVER_ERROR', 'Down', 500));
    await expect(getMe()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });

  it('verifyEmail posts the token to /api/auth/verify-email', async () => {
    mockApi.mockResolvedValue({ emailVerified: true, alreadyVerified: false });

    const result = await verifyEmail('a'.repeat(64));

    expect(mockApi).toHaveBeenCalledWith('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(64) }),
    });
    expect(result).toEqual({ emailVerified: true, alreadyVerified: false });
  });

  it('resendVerification posts without a body', async () => {
    mockApi.mockResolvedValue({ requested: true, emailVerified: false });

    await resendVerification();

    expect(mockApi).toHaveBeenCalledWith('/api/auth/verify-email/resend', { method: 'POST' });
  });
});
