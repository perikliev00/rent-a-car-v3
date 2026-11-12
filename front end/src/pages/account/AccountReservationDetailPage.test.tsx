// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { render, screen } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '../../auth/auth-context'.
import { AuthContext } from '../../auth/auth-context';
// Import named exports from './AccountReservationDetailPage'.
import { AccountReservationDetailPage } from './AccountReservationDetailPage';

// Call vi.mock to perform this step.
vi.mock('../../api/account', () => ({
  // Provide the get account reservation field value.
  getAccountReservation: vi.fn().mockResolvedValue({
    // Provide the reservation field value.
    reservation: {
      // Provide the id field value.
      id: '10',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the payment status field value.
      paymentStatus: 'paid',
      // Provide the car name field value.
      carName: 'Yaris',
      // Provide the pickup date field value.
      pickupDate: '2026-08-10',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return date field value.
      returnDate: '2026-08-12',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the total price field value.
      totalPrice: 180,
      // Provide the pickup instructions field value.
      pickupInstructions: ['Bring your license'],
      // Provide the return instructions field value.
      returnInstructions: ['Full tank'],
      // Provide the available pdfs field value.
      availablePdfs: ['invoice'],
      // Provide the can request cancellation field value.
      canRequestCancellation: true,
    },
  }),
  // Provide the update travel details field value.
  updateTravelDetails: vi.fn(),
  // Provide the request cancellation field value.
  requestCancellation: vi.fn(),
  // Provide the download reservation pdf field value.
  downloadReservationPdf: vi.fn(),
}));

// Define the renderPage function.
function renderPage() {
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

// Declare a test suite grouping related cases.
describe('AccountReservationDetailPage', () => {
  // Define a single test case and its expectations.
  it('renders reservation detail', async () => {
    // Call renderPage to perform this step.
    renderPage();

    // Assert that the value matches the intended expectation.
    expect(await screen.findByRole('heading', { name: 'Reservation #10' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Bring your license/)).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Full tank/)).toBeInTheDocument();
  });
});
