import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReservationOpsDashboard,
  listCancellationRequests,
  refundReservation,
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

describe('AdminReservationOpsPage', () => {
  beforeEach(() => {
    vi.mocked(getReservationOpsDashboard).mockResolvedValue({
      today: '2026-08-04',
      limit: 20,
      widgets: {
        todaysPickups: [],
        todaysReturns: [],
        activeRentals: [],
        overdueReturns: [],
        manualReview: [
          {
            id: '42',
            status: 'manual_review',
            pickupDate: '2026-08-10',
            returnDate: '2026-08-12',
            fullName: 'Refund Guest',
            carName: 'Test Car',
          },
        ],
        paidNotConfirmed: [],
        cancelled: [],
        failedPayments: [],
      },
    });
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

  it('shows Refund action and calls refundReservation', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).not.toContain(
      'refunded'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    await waitFor(() => {
      expect(refundReservation).toHaveBeenCalledWith('42', {
        reason: 'admin_ops_dashboard_refund',
      });
    });
  });
});
