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
// Import named exports from './AccountReservationsPage'.
import { AccountReservationsPage } from './AccountReservationsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/account', () => ({
  // Provide the list account reservations field value.
  listAccountReservations: vi.fn().mockResolvedValue({
    // Provide the reservations field value.
    reservations: [
      {
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
        // Provide the return date field value.
        returnDate: '2026-08-12',
        // Provide the total price field value.
        totalPrice: 180,
      },
    ],
  }),
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

// Declare a test suite grouping related cases.
describe('AccountReservationsPage', () => {
  // Define a single test case and its expectations.
  it('renders reservation list', async () => {
    // Call renderPage to perform this step.
    renderPage();

    // Assert that the value matches the intended expectation.
    expect(await screen.findByRole('heading', { name: 'My reservations' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Yaris · Reservation #10/)).toBeInTheDocument();
  });
});
