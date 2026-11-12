// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { render, screen } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '../../auth/auth-context'.
import { AuthContext } from '../../auth/auth-context';
// Import named exports from '../../pages/account/AccountDashboardPage'.
import { AccountDashboardPage } from '../../pages/account/AccountDashboardPage';

// Call vi.mock to perform this step.
vi.mock('../../api/account', () => ({
  // Provide the get account dashboard field value.
  getAccountDashboard: vi.fn().mockResolvedValue({
    // Provide the counts field value.
    counts: { total: 0, active: 0, completed: 0 },
    // Provide the upcoming field value.
    upcoming: null,
    // Provide the recent field value.
    recent: [],
  }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/auth', () => ({
  // Provide the resend verification field value.
  resendVerification: vi.fn(),
}));

// Define the renderDashboard function.
function renderDashboard() {
  // Create the query client constant.
  const queryClient = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false } },
  });

  // Return the resulting value to the caller.
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

// Declare a test suite grouping related cases.
describe('AccountDashboardPage', () => {
  // Define a single test case and its expectations.
  it('renders dashboard for authenticated users', async () => {
    // Call renderDashboard to perform this step.
    renderDashboard();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
