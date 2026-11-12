// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/payments'.
import { getPaymentRefundQueue, getPayments } from '../../api/admin/payments';
// Import named exports from '../../api/admin/reservations'.
import { refundReservation } from '../../api/admin/reservations';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminPaymentsPage'.
import { AdminPaymentsPage } from './AdminPaymentsPage';
// Contribute this line to the enclosing declaration or statement.
import type { OpsReservationRow } from '../../api/admin/reservations';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/payments', () => ({
  // Provide the get payments field value.
  getPayments: vi.fn(),
  // Provide the reconcile payments field value.
  reconcilePayments: vi.fn(),
  // Provide the get payment refund queue field value.
  getPaymentRefundQueue: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/reservations', () => ({
  // Provide the refund reservation field value.
  refundReservation: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Continue the surrounding logic with this statement.
const refundableRow: OpsReservationRow = {
  // Provide the id field value.
  id: '512',
  // Provide the status field value.
  status: 'confirmed',
  // Provide the pickup date field value.
  pickupDate: '2026-08-20',
  // Provide the return date field value.
  returnDate: '2026-08-23',
  // Provide the full name field value.
  fullName: 'Paid Guest',
  // Provide the email field value.
  email: 'paid@example.com',
  // Provide the car name field value.
  carName: 'Golf',
  // Provide the order id field value.
  orderId: '88',
  // Provide the total price field value.
  totalPrice: 210,
};

// Define the authUser function.
function authUser(overrides: { roles?: string[]; permissions?: string[] } = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: '1',
      // Provide the email field value.
      email: 'admin@example.com',
      // Provide the role field value.
      role: 'admin',
      // Provide the roles field value.
      roles: overrides.roles ?? ['owner'],
      // Provide the permissions field value.
      permissions: overrides.permissions ?? ['can_refund_payments'],
    },
    // Provide the is loading field value.
    isLoading: false,
    // Provide the login field value.
    login: vi.fn(),
    // Provide the logout field value.
    logout: vi.fn(),
  };
}

// Declare a test suite grouping related cases.
describe('AdminPaymentsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue(authUser() as never);
    // Call vi.mocked to perform this step.
    vi.mocked(getPayments).mockResolvedValue({
      // Provide the events field value.
      events: [],
      // Provide the failures field value.
      failures: [],
      // Provide the unresolved failure count field value.
      unresolvedFailureCount: 0,
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      // Provide the refundable field value.
      refundable: [refundableRow],
      // Provide the recent refunds field value.
      recentRefunds: [],
      // Provide the limit field value.
      limit: 50,
    });
    // Call vi.mocked to perform this step.
    vi.mocked(refundReservation).mockResolvedValue({
      // Provide the status field value.
      status: 'succeeded',
      // Provide the refund operation field value.
      refundOperation: { id: 1 },
      // Provide the reservation field value.
      reservation: { id: '512', status: 'refunded' } as never,
    });
  });

  // Define a single test case and its expectations.
  it('renders payments page', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Reconcile' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders refundable row with reservation and order ids', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Refundable bookings' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('#512')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('#88')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Golf')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Paid Guest')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('210.00 EUR')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByText('none').length).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('opens confirm dialog without calling the API; cancel stays no-op', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByText('#512').length).toBeGreaterThan(1);
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByText('210.00 EUR').length).toBeGreaterThan(0);

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('confirm sends refundReservation with reason', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: ' guest asked ' } });
    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(refundReservation).toHaveBeenCalledWith('512', { reason: 'guest asked' });
    });
  });

  // Define a single test case and its expectations.
  it('pending ledger disables refund and does not open confirm', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      // Provide the refundable field value.
      refundable: [
        {
          // Spread refundableRow into the surrounding structure.
          ...refundableRow,
          // Provide the refund operation field value.
          refundOperation: {
            // Provide the id field value.
            id: 9,
            // Provide the status field value.
            status: 'pending',
            // Provide the amount cents field value.
            amountCents: 21000,
            // Provide the currency field value.
            currency: 'eur',
          },
        },
      ],
      // Provide the recent refunds field value.
      recentRefunds: [],
      // Provide the limit field value.
      limit: 50,
    });

    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Refund pending')).toBeInTheDocument();
    });

    // Create the refund btn constant.
    const refundBtn = screen.getByRole('button', { name: 'Refund' });
    // Assert that the value matches the intended expectation.
    expect(refundBtn).toBeDisabled();
    // Call fireEvent.click to perform this step.
    fireEvent.click(refundBtn);
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('failed ledger shows Retry refund and still requires confirm', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      // Provide the refundable field value.
      refundable: [
        {
          // Spread refundableRow into the surrounding structure.
          ...refundableRow,
          // Provide the refund operation field value.
          refundOperation: {
            // Provide the id field value.
            id: 9,
            // Provide the status field value.
            status: 'failed',
            // Provide the amount cents field value.
            amountCents: 21000,
            // Provide the currency field value.
            currency: 'eur',
            // Provide the failure message field value.
            failureMessage: 'Stripe refund failed',
          },
        },
      ],
      // Provide the recent refunds field value.
      recentRefunds: [],
      // Provide the limit field value.
      limit: 50,
    });

    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText(/Refund failed/)).toBeInTheDocument();
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Retry refund' }));
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(refundReservation).toHaveBeenCalledWith(
        // Supply the literal value used by the enclosing expression.
        '512',
        // Call expect.objectContaining to perform this step.
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
  });

  // Define a single test case and its expectations.
  it('hides refund queue and reconcile without can_refund_payments', async () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue(
      // Call authUser to perform this step.
      authUser({
        // Provide the roles field value.
        roles: ['accountant'],
        // Provide the permissions field value.
        permissions: ['can_manage_payments_monitor', 'can_view_revenue'],
      // Continue the surrounding logic with this statement.
      }) as never
    );

    renderWithRouter(<AdminPaymentsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('heading', { name: 'Refundable bookings' })).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('button', { name: 'Reconcile' })).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(getPaymentRefundQueue).not.toHaveBeenCalled();
  });
});
