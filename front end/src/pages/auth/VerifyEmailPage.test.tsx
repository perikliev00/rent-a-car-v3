// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'react'.
import { StrictMode } from 'react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import '../../api/auth' as the authApi namespace.
import * as authApi from '../../api/auth';
// Import named exports from '../../test/test-utils'.
import { renderWithAuth } from '../../test/test-utils';
// Import named exports from './VerifyEmailPage'.
import { VerifyEmailPage } from './VerifyEmailPage';

// Call vi.mock to perform this step.
vi.mock('../../api/auth', () => ({
  // Provide the get me field value.
  getMe: vi.fn(),
  // Provide the login field value.
  login: vi.fn(),
  // Provide the signup field value.
  signup: vi.fn(),
  // Provide the logout field value.
  logout: vi.fn(),
  // Provide the verify email field value.
  verifyEmail: vi.fn(),
  // Provide the resend verification field value.
  resendVerification: vi.fn(),
}));

// Create the mock navigate constant.
const mockNavigate = vi.fn();

// Call vi.mock to perform this step.
vi.mock('react-router-dom', async () => {
  // Create the actual constant.
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the use navigate field value.
    useNavigate: () => mockNavigate,
  };
});

// Declare a test suite grouping related cases.
describe('VerifyEmailPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  // Define a single test case and its expectations.
  it('prompts the user to check email when no token is present', async () => {
    renderWithAuth(<VerifyEmailPage />, { route: '/verify-email', path: '/verify-email' });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('verifies once under Strict Mode and navigates to account', async () => {
    // Create the token constant.
    const token = 'a'.repeat(64);
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      // Provide the user field value.
      user: { id: '1', email: 'a@b.com', role: 'user', emailVerified: true },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue({
      // Provide the user field value.
      user: { id: '1', email: 'a@b.com', role: 'user', emailVerified: true },
    });

    // Call renderWithAuth to perform this step.
    renderWithAuth(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
      // Continue the surrounding logic with this statement.
      { route: `/verify-email?token=${token}`, path: '/verify-email' },
    );

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true });
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.verifyEmail).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(authApi.verifyEmail).toHaveBeenCalledWith(token);
  });
});
