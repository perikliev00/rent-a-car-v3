import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/auth-context';
import { AccountReservationsPage } from './AccountReservationsPage';

vi.mock('../../api/account', () => ({
  listAccountReservations: vi.fn().mockResolvedValue({
    reservations: [
      {
        id: '10',
        status: 'confirmed',
        paymentStatus: 'paid',
        carName: 'Yaris',
        pickupDate: '2026-08-10',
        returnDate: '2026-08-12',
        totalPrice: 180,
      },
    ],
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: { id: '1', email: 'demo@luxride.local', role: 'user' },
          isLoading: false,
          login: vi.fn(),
          signup: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/account/reservations']}>
          <Routes>
            <Route path="/account/reservations" element={<AccountReservationsPage />} />
            <Route path="/account" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('AccountReservationsPage', () => {
  it('renders reservation list', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'My reservations' })).toBeInTheDocument();
    expect(screen.getByText(/Yaris · Reservation #10/)).toBeInTheDocument();
  });
});
