import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/account', () => ({
  getAccountDashboard: vi.fn().mockResolvedValue({
    counts: { total: 0, active: 0, completed: 0 },
    upcoming: null,
    recent: [],
  }),
}));

import { AccountDashboardPage } from '../../pages/account/AccountDashboardPage';

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountDashboardPage', () => {
  it('renders dashboard for authenticated users', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
