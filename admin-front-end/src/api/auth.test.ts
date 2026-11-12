// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();
// Create the mock set csrf token constant.
const mockSetCsrfToken = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
  // Provide the set csrf token field value.
  setCsrfToken: (...args: unknown[]) => mockSetCsrfToken(...args),
  // Provide the api error field value.
  ApiError: class ApiError extends Error {
    // Call constructor to perform this step.
    constructor(
      // Contribute this line to the enclosing declaration or statement.
      public code: string,
      // Provide the message field value.
      message: string,
      // Contribute this line to the enclosing declaration or statement.
      public status: number,
    // Continue the surrounding logic with this statement.
    ) {
      // Call super to perform this step.
      super(message);
      // Update this.name with the right-hand side value.
      this.name = 'ApiError';
    }
  },
}));

// Import named exports from './client'.
import { ApiError } from './client';
// Import named exports from './auth'.
import { getMe, login, logout, signup, verifyEmail, resendVerification } from './auth';

// Declare a test suite grouping related cases.
describe('auth API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
    // Call mockSetCsrfToken.mockReset to perform this step.
    mockSetCsrfToken.mockReset();
  });

  // Define a single test case and its expectations.
  it('login posts credentials to /api/auth/login', async () => {
    // Create the user constant.
    const user = { id: '1', email: 'a@b.com', role: 'user' as const };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ user });

    // Create the result constant.
    const result = await login('a@b.com', 'secret');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/auth/login', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ user });
  });

  // Define a single test case and its expectations.
  it('signup posts credentials to /api/auth/signup', async () => {
    // Create the user constant.
    const user = { id: '2', email: 'new@b.com', role: 'user' as const };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ user });

    // Wait until the asynchronous operation resolves.
    await signup('new@b.com', 'pass123');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/auth/signup', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ email: 'new@b.com', password: 'pass123' }),
    });
  });

  // Define a single test case and its expectations.
  it('verifyEmail posts the token', async () => {
    // Create the user constant.
    const user = { id: '2', email: 'new@b.com', role: 'user' as const, emailVerified: true };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ user });

    // Wait until the asynchronous operation resolves.
    await verifyEmail('abc123');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/auth/verify-email', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ token: 'abc123' }),
    });
  });

  // Define a single test case and its expectations.
  it('resendVerification posts without a body', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ sent: true });

    // Wait until the asynchronous operation resolves.
    await resendVerification();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/auth/resend-verification', {
      // Provide the method field value.
      method: 'POST',
    });
  });

  // Define a single test case and its expectations.
  it('logout clears CSRF token after POST', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ loggedOut: true });

    // Create the result constant.
    const result = await logout();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    // Assert that the value matches the intended expectation.
    expect(mockSetCsrfToken).toHaveBeenCalledWith(null);
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ loggedOut: true });
  });

  // Define a single test case and its expectations.
  it('getMe returns null on 401 and rethrows other errors', async () => {
    // Call mockApi.mockRejectedValueOnce to perform this step.
    mockApi.mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'Please log in', 401));
    // Wait until the asynchronous operation resolves.
    await expect(getMe()).resolves.toBeNull();

    // Call mockApi.mockRejectedValueOnce to perform this step.
    mockApi.mockRejectedValueOnce(new ApiError('SERVER_ERROR', 'Down', 500));
    // Wait until the asynchronous operation resolves.
    await expect(getMe()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });
});
