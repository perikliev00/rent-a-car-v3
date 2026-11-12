import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/auth-context';
import { AccountReservationDetailPage } from './AccountReservationDetailPage';

vi.mock('../../api/account', () => ({
  getAccountReservation: vi.fn().mockResolvedValue({
    reservation: {
      id: '10',
      status: 'confirmed',
      paymentStatus: 'paid',
      carName: 'Yaris',
      pickupDate: '2026-08-10',
      pickupTime: '10:00',
      returnDate: '2026-08-12',
      returnTime: '10:00',
      pickupLocation: 'office',
      returnLocation: 'office',
      totalPrice: 180,
      pickupInstructions: ['Bring your license'],
      returnInstructions: ['Full tank'],
      availablePdfs: ['invoice'],
      canRequestCancellation: true,
    },
  }),
  updateTravelDetails: vi.fn(),
  requestCancellation: vi.fn(),
  downloadReservationPdf: vi.fn(),
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
        <MemoryRouter initialEntries={['/account/reservations/10']}>
          <Routes>
            <Route path="/account/reservations/:id" element={<AccountReservationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('AccountReservationDetailPage', () => {
  it('renders reservation detail', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Reservation #10' })).toBeInTheDocument();
    expect(screen.getByText(/Bring your license/)).toBeInTheDocument();
    expect(screen.getByText(/Full tank/)).toBeInTheDocument();
  });
});
