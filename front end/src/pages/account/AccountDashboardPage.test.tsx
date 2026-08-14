import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '../../auth/ProtectedRoute';
import { AuthContext } from '../../auth/auth-context';

vi.mock('../../api/account', () => ({
  getAccountDashboard: vi.fn().mockResolvedValue({
    counts: { total: 0, active: 0, completed: 0 },
    upcoming: null,
    recent: [],
  }),
}));

import { AccountDashboardPage } from '../../pages/account/AccountDashboardPage';

function renderAccount(user: { id: string; email: string; role: 'user' | 'admin' } | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          login: vi.fn(),
          signup: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountDashboardPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Account portal routes', () => {
  it('redirects unauthenticated users to login', () => {
    renderAccount(null);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders dashboard for authenticated users', async () => {
    renderAccount({ id: '1', email: 'demo@luxride.local', role: 'user' });
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
