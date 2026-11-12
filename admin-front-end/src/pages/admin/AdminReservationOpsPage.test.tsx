// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getReservationOpsDashboard,
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  refundReservation,
  // Declare the OpsReservationRow TypeScript type alias.
  type OpsReservationRow,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/reservations';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminReservationOpsPage'.
import { AdminReservationOpsPage } from './AdminReservationOpsPage';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: () => ({
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: 1,
      // Provide the email field value.
      email: 'admin@example.com',
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ['can_refund_payments', 'can_change_reservation_status', 'can_view_reservations_ops'],
    },
  }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/reservations', () => ({
  // Provide the admin ops status options field value.
  ADMIN_OPS_STATUS_OPTIONS: ['confirmed', 'car_prepared', 'picked_up'],
  // Provide the refundable ops statuses field value.
  REFUNDABLE_OPS_STATUSES: ['paid', 'manual_review', 'confirmed', 'car_prepared'],
  // Provide the get reservation ops dashboard field value.
  getReservationOpsDashboard: vi.fn(),
  // Provide the get reservation detail field value.
  getReservationDetail: vi.fn(),
  // Provide the change reservation status field value.
  changeReservationStatus: vi.fn(),
  // Provide the refund reservation field value.
  refundReservation: vi.fn(),
  // Provide the get reservation checklists field value.
  getReservationChecklists: vi.fn(),
  // Provide the list cancellation requests field value.
  listCancellationRequests: vi.fn(),
  // Provide the review cancellation request field value.
  reviewCancellationRequest: vi.fn(),
  // Provide the submit pickup checklist field value.
  submitPickupChecklist: vi.fn(),
  // Provide the submit return checklist field value.
  submitReturnChecklist: vi.fn(),
}));

// Continue the surrounding logic with this statement.
const baseRow: OpsReservationRow = {
  // Provide the id field value.
  id: '42',
  // Provide the status field value.
  status: 'manual_review',
  // Provide the pickup date field value.
  pickupDate: '2026-08-10',
  // Provide the return date field value.
  returnDate: '2026-08-12',
  // Provide the full name field value.
  fullName: 'Refund Guest',
  // Provide the car name field value.
  carName: 'Test Car',
  // Provide the total price field value.
  totalPrice: 100,
};

// Define the dashboardWith function.
function dashboardWith(row: OpsReservationRow) {
  // Return the resulting value to the caller.
  return {
    // Provide the today field value.
    today: '2026-08-04',
    // Provide the limit field value.
    limit: 20,
    // Provide the widgets field value.
    widgets: {
      // Provide the todays pickups field value.
      todaysPickups: [],
      // Provide the todays returns field value.
      todaysReturns: [],
      // Provide the active rentals field value.
      activeRentals: [],
      // Provide the overdue returns field value.
      overdueReturns: [],
      // Provide the manual review field value.
      manualReview: [row],
      // Provide the paid not confirmed field value.
      paidNotConfirmed: [],
      // Provide the cancelled field value.
      cancelled: [],
      // Provide the failed payments field value.
      failedPayments: [],
    },
  };
}

// Declare a test suite grouping related cases.
describe('AdminReservationOpsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Call vi.mocked to perform this step.
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(dashboardWith(baseRow));
    // Call vi.mocked to perform this step.
    vi.mocked(listCancellationRequests).mockResolvedValue({ requests: [] });
    // Call vi.mocked to perform this step.
    vi.mocked(refundReservation).mockResolvedValue({
      // Provide the status field value.
      status: 'succeeded',
      // Provide the refund operation field value.
      refundOperation: { id: 1 },
      // Provide the reservation field value.
      reservation: { id: '42', status: 'refunded' } as never,
    });
  });

  // Define a single test case and its expectations.
  it('renders ops dashboard widgets', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Reservation Ops' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: "Today's Pickups" })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('opens confirm dialog without calling the API; cancel stays no-op', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    // Create the select constant.
    const select = screen.getByRole('combobox');
    // Assert that the value matches the intended expectation.
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).not.toContain(
      // Supply the literal value used by the enclosing expression.
      'refunded'
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('#42')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('100.00 EUR')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(
      // Call screen.getByText to perform this step.
      screen.getByText('This returns the money via Stripe and cannot be undone.')
    // Continue the surrounding logic with this statement.
    ).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Assert that the value matches the intended expectation.
    expect(refundReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('confirm sends refundReservation with reason', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

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
      expect(refundReservation).toHaveBeenCalledWith('42', { reason: 'guest asked' });
    });
  });

  // Define a single test case and its expectations.
  it('pending ledger disables refund and does not open confirm', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(
      // Call dashboardWith to perform this step.
      dashboardWith({
        // Spread baseRow into the surrounding structure.
        ...baseRow,
        // Provide the refund operation field value.
        refundOperation: {
          // Provide the id field value.
          id: 9,
          // Provide the status field value.
          status: 'pending',
          // Provide the amount cents field value.
          amountCents: 10000,
          // Provide the currency field value.
          currency: 'eur',
        },
      })
    );

    renderWithRouter(<AdminReservationOpsPage />);

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
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(
      // Call dashboardWith to perform this step.
      dashboardWith({
        // Spread baseRow into the surrounding structure.
        ...baseRow,
        // Provide the refund operation field value.
        refundOperation: {
          // Provide the id field value.
          id: 9,
          // Provide the status field value.
          status: 'failed',
          // Provide the amount cents field value.
          amountCents: 10000,
          // Provide the currency field value.
          currency: 'eur',
          // Provide the failure message field value.
          failureMessage: 'Stripe refund failed',
        },
      })
    );

    renderWithRouter(<AdminReservationOpsPage />);

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
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('100.00 EUR')).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(refundReservation).toHaveBeenCalledWith(
        // Supply the literal value used by the enclosing expression.
        '42',
        // Call expect.objectContaining to perform this step.
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
  });

  // Define a single test case and its expectations.
  it('does not show refund on paid-not-confirmed rows', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getReservationOpsDashboard).mockResolvedValue({
      // Provide the today field value.
      today: '2026-08-04',
      // Provide the limit field value.
      limit: 20,
      // Provide the widgets field value.
      widgets: {
        // Provide the todays pickups field value.
        todaysPickups: [],
        // Provide the todays returns field value.
        todaysReturns: [],
        // Provide the active rentals field value.
        activeRentals: [],
        // Provide the overdue returns field value.
        overdueReturns: [],
        // Provide the manual review field value.
        manualReview: [],
        // Provide the paid not confirmed field value.
        paidNotConfirmed: [{ ...baseRow, id: '99', status: 'paid' }],
        // Provide the cancelled field value.
        cancelled: [],
        // Provide the failed payments field value.
        failedPayments: [],
      },
    });

    renderWithRouter(<AdminReservationOpsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  });
});
