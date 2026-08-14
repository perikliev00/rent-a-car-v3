import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../api/auth';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

vi.mock('../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

const mockUser = { id: '1', email: 'user@example.com', role: 'user' as const };

function AuthConsumer() {
  const { user, isLoading, login, signup, logout } = useAuth();
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

function renderAuthProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const clearSpy = vi.spyOn(queryClient, 'clear');

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { queryClient, clearSpy };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getMe).mockResolvedValue(null);
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });
    vi.mocked(authApi.signup).mockResolvedValue({ user: mockUser });
    vi.mocked(authApi.logout).mockResolvedValue({ loggedOut: true });
  });

  it('refreshes user on mount and finishes loading', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: mockUser });
    renderAuthProvider();

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  it('login updates user and clears query cache', async () => {
    const { clearSpy } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    expect(authApi.login).toHaveBeenCalledWith('user@example.com', 'password1');
    expect(clearSpy).toHaveBeenCalled();
  });

  it('signup updates user and clears query cache', async () => {
    const { clearSpy } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'signup' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    expect(authApi.signup).toHaveBeenCalledWith('new@example.com', 'password1');
    expect(clearSpy).toHaveBeenCalled();
  });

  it('logout clears user and query cache', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: mockUser });
    const { clearSpy } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });

    expect(authApi.logout).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });
});
