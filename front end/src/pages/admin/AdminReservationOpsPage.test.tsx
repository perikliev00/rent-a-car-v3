import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReservationOpsDashboard, listCancellationRequests } from '../../api/admin/reservations';
import { renderWithRouter } from '../../test/test-utils';
import { AdminReservationOpsPage } from './AdminReservationOpsPage';

vi.mock('../../api/admin/reservations', () => ({
  ADMIN_OPS_STATUS_OPTIONS: ['confirmed', 'car_prepared', 'picked_up'],
  getReservationOpsDashboard: vi.fn(),
  getReservationDetail: vi.fn(),
  changeReservationStatus: vi.fn(),
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
        manualReview: [],
        paidNotConfirmed: [],
        cancelled: [],
        failedPayments: [],
      },
    });
    vi.mocked(listCancellationRequests).mockResolvedValue({ requests: [] });
  });

  it('renders ops dashboard widgets', async () => {
    renderWithRouter(<AdminReservationOpsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reservation Ops' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: "Today's Pickups" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
