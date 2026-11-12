import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReservationOpsDashboard,
  listCancellationRequests,
  refundReservation,
  type OpsReservationRow,
} from '../../api/admin/reservations';
import { renderWithRouter } from '../../test/test-utils';
import { AdminReservationOpsPage } from './AdminReservationOpsPage';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@example.com',
      roles: ['owner'],
      permissions: ['can_refund_payments', 'can_change_reservation_status', 'can_view_reservations_ops'],
    },
  }),
}));

vi.mock('../../api/admin/reservations', () => ({
  ADMIN_OPS_STATUS_OPTIONS: ['confirmed', 'car_prepared', 'picked_up'],
  REFUNDABLE_OPS_STATUSES: ['paid', 'manual_review', 'confirmed', 'car_prepared'],
  getReservationOpsDashboard: vi.fn(),
  getReservationDetail: vi.fn(),
  changeReservationStatus: vi.fn(),
  refundReservation: vi.fn(),
  getReservationChecklists: vi.fn(),
  listCancellationRequests: vi.fn(),
  reviewCancellationRequest: vi.fn(),
  submitPickupChecklist: vi.fn(),
  submitReturnChecklist: vi.fn(),
}));

const baseRow: OpsReservationRow = {
  id: '42',
  status: 'manual_review',
  pickupDate: '2026-08-10',
  returnDate: '2026-08-12',
  fullName: 'Refund Guest',
  carName: 'Test Car',
  totalPrice: 100,
};

function dashboardWith(row: OpsReservationRow) {
  return {
    today: '2026-08-04',
    limit: 20,
    widgets: {
      todaysPickups: [],
      todaysReturns: [],
      activeRentals: [],
      overdueReturns: [],
      manualReview: [row],
      paidNotConfirmed: [],
      cancelled: [],
      failedPayments: [],
    },
  };
}

describe('AdminReservationOpsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(dashboardWith(baseRow));
    vi.mocked(listCancellationRequests).mockResolvedValue({ requests: [] });
    vi.mocked(refundReservation).mockResolvedValue({
      status: 'succeeded',
      refundOperation: { id: 1 },
      reservation: { id: '42', status: 'refunded' } as never,
    });
  });

  it('renders ops dashboard widgets', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reservation Ops' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: "Today's Pickups" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('opens confirm dialog without calling the API; cancel stays no-op', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).not.toContain(
      'refunded'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('100.00 EUR')).toBeInTheDocument();
    expect(
      screen.getByText('This returns the money via Stripe and cannot be undone.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm sends refundReservation with reason', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: ' guest asked ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));

    await waitFor(() => {
      expect(refundReservation).toHaveBeenCalledWith('42', { reason: 'guest asked' });
    });
  });

  it('pending ledger disables refund and does not open confirm', async () => {
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(
      dashboardWith({
        ...baseRow,
        refundOperation: {
          id: 9,
          status: 'pending',
          amountCents: 10000,
          currency: 'eur',
        },
      })
    );

    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByText('Refund pending')).toBeInTheDocument();
    });

    const refundBtn = screen.getByRole('button', { name: 'Refund' });
    expect(refundBtn).toBeDisabled();
    fireEvent.click(refundBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(refundReservation).not.toHaveBeenCalled();
  });

  it('failed ledger shows Retry refund and still requires confirm', async () => {
    vi.mocked(getReservationOpsDashboard).mockResolvedValue(
      dashboardWith({
        ...baseRow,
        refundOperation: {
          id: 9,
          status: 'failed',
          amountCents: 10000,
          currency: 'eur',
          failureMessage: 'Stripe refund failed',
        },
      })
    );

    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Refund failed/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry refund' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('100.00 EUR')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
    await waitFor(() => {
      expect(refundReservation).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
  });

  it('does not show refund on paid-not-confirmed rows', async () => {
    vi.mocked(getReservationOpsDashboard).mockResolvedValue({
      today: '2026-08-04',
      limit: 20,
      widgets: {
        todaysPickups: [],
        todaysReturns: [],
        activeRentals: [],
        overdueReturns: [],
        manualReview: [],
        paidNotConfirmed: [{ ...baseRow, id: '99', status: 'paid' }],
        cancelled: [],
        failedPayments: [],
      },
    });

    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  });
});
