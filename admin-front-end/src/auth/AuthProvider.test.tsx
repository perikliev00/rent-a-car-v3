// Import named exports from '@testing-library/react'.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import '../api/auth' as the authApi namespace.
import * as authApi from '../api/auth';
// Import named exports from './AuthProvider'.
import { AuthProvider } from './AuthProvider';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';

// Call vi.mock to perform this step.
vi.mock('../api/auth', () => ({
  // Provide the get me field value.
  getMe: vi.fn(),
  // Provide the login field value.
  login: vi.fn(),
  // Provide the signup field value.
  signup: vi.fn(),
  // Provide the logout field value.
  logout: vi.fn(),
}));

// Create the mock user constant.
const mockUser = { id: '1', email: 'user@example.com', role: 'user' as const };

// Define the AuthConsumer function.
function AuthConsumer() {
  // Destructure object properties into local variables.
  const { user, isLoading, login, signup, logout } = useAuth();
  // Return control to the caller with the following value.
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <button type="button" onClick={() => login('user@example.com', 'password1')}>
        login
      </button>
      <button type="button" onClick={() => signup('new@example.com', 'password1')}>
        signup
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

// Define the renderAuthProvider function.
function renderAuthProvider() {
  // Create the query client constant.
  const queryClient = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Create the clear spy constant.
  const clearSpy = vi.spyOn(queryClient, 'clear');

  // Call render to perform this step.
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  );

  // Return the resulting value to the caller.
  return { queryClient, clearSpy };
}

// Declare a test suite grouping related cases.
describe('AuthProvider', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue(null);
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.signup).mockResolvedValue({ user: mockUser });
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.logout).mockResolvedValue({ loggedOut: true });
  });

  // Define a single test case and its expectations.
  it('refreshes user on mount and finishes loading', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue({ user: mockUser });
    // Call renderAuthProvider to perform this step.
    renderAuthProvider();

    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  // Define a single test case and its expectations.
  it('login updates user and clears query cache', async () => {
    // Destructure object properties into local variables.
    const { clearSpy } = renderAuthProvider();

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.login).toHaveBeenCalledWith('user@example.com', 'password1');
    // Assert that the value matches the intended expectation.
    expect(clearSpy).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('signup updates user and clears query cache', async () => {
    // Destructure object properties into local variables.
    const { clearSpy } = renderAuthProvider();

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'signup' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.signup).toHaveBeenCalledWith('new@example.com', 'password1');
    // Assert that the value matches the intended expectation.
    expect(clearSpy).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('logout clears user and query cache', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(authApi.getMe).mockResolvedValue({ user: mockUser });
    // Destructure object properties into local variables.
    const { clearSpy } = renderAuthProvider();

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });

    // Assert that the value matches the intended expectation.
    expect(authApi.logout).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(clearSpy).toHaveBeenCalled();
  });
});
