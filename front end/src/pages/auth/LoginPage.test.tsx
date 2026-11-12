// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import '../../api/auth' as the authApi namespace.
import * as authApi from '../../api/auth';
// Import named exports from '../../test/test-utils'.
import { renderWithAuth } from '../../test/test-utils';
// Import named exports from './LoginPage'.
import { LoginPage } from './LoginPage';

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
}));

// Declare a test suite grouping related cases.
describe('LoginPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  // Define a single test case and its expectations.
  it('renders login form', async () => {
    renderWithAuth(<LoginPage />, { route: '/login', path: '/login' });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
