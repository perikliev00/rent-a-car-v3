import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/auth-context';
import { AccountDashboardPage } from '../../pages/account/AccountDashboardPage';

vi.mock('../../api/account', () => ({
  getAccountDashboard: vi.fn().mockResolvedValue({
    counts: { total: 0, active: 0, completed: 0 },
    upcoming: null,
    recent: [],
  }),
}));

vi.mock('../../api/auth', () => ({
  resendVerification: vi.fn(),
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: { id: '1', email: 'demo@luxride.local', role: 'user', emailVerified: true },
          isLoading: false,
          login: vi.fn(),
          signup: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <MemoryRouter>
          <AccountDashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('AccountDashboardPage', () => {
  it('renders dashboard for authenticated users', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
