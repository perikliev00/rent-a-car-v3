import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPaymentRefundQueue, getPayments } from '../../api/admin/payments';
import { refundReservation } from '../../api/admin/reservations';
import { useAuth } from '../../auth/useAuth';
import { renderWithRouter } from '../../test/test-utils';
import { AdminPaymentsPage } from './AdminPaymentsPage';
import type { OpsReservationRow } from '../../api/admin/reservations';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../api/admin/payments', () => ({
  getPayments: vi.fn(),
  reconcilePayments: vi.fn(),
  getPaymentRefundQueue: vi.fn(),
}));

vi.mock('../../api/admin/reservations', () => ({
  refundReservation: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const refundableRow: OpsReservationRow = {
  id: '512',
  status: 'confirmed',
  pickupDate: '2026-08-20',
  returnDate: '2026-08-23',
  fullName: 'Paid Guest',
  email: 'paid@example.com',
  carName: 'Golf',
  orderId: '88',
  totalPrice: 210,
};

function authUser(overrides: { roles?: string[]; permissions?: string[] } = {}) {
  return {
    user: {
      id: '1',
      email: 'admin@example.com',
      role: 'admin',
      roles: overrides.roles ?? ['owner'],
      permissions: overrides.permissions ?? ['can_refund_payments'],
    },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue(authUser() as never);
    vi.mocked(getPayments).mockResolvedValue({
      events: [],
      failures: [],
      unresolvedFailureCount: 0,
    });
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      refundable: [refundableRow],
      recentRefunds: [],
      limit: 50,
    });
    vi.mocked(refundReservation).mockResolvedValue({
      status: 'succeeded',
      refundOperation: { id: 1 },
      reservation: { id: '512', status: 'refunded' } as never,
    });
  });

  it('renders payments page', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reconcile' })).toBeInTheDocument();
  });

  it('renders refundable row with reservation and order ids', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Refundable bookings' })).toBeInTheDocument();
    });

    expect(screen.getByText('#512')).toBeInTheDocument();
    expect(screen.getByText('#88')).toBeInTheDocument();
    expect(screen.getByText('Golf')).toBeInTheDocument();
    expect(screen.getByText('Paid Guest')).toBeInTheDocument();
    expect(screen.getByText('210.00 EUR')).toBeInTheDocument();
    expect(screen.getAllByText('none').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
  });

  it('opens confirm dialog without calling the API; cancel stays no-op', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('#512').length).toBeGreaterThan(1);
    expect(screen.getAllByText('210.00 EUR').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm sends refundReservation with reason', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: ' guest asked ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));

    await waitFor(() => {
      expect(refundReservation).toHaveBeenCalledWith('512', { reason: 'guest asked' });
    });
  });

  it('pending ledger disables refund and does not open confirm', async () => {
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      refundable: [
        {
          ...refundableRow,
          refundOperation: {
            id: 9,
            status: 'pending',
            amountCents: 21000,
            currency: 'eur',
          },
        },
      ],
      recentRefunds: [],
      limit: 50,
    });

    renderWithRouter(<AdminPaymentsPage />);

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
    vi.mocked(getPaymentRefundQueue).mockResolvedValue({
      refundable: [
        {
          ...refundableRow,
          refundOperation: {
            id: 9,
            status: 'failed',
            amountCents: 21000,
            currency: 'eur',
            failureMessage: 'Stripe refund failed',
          },
        },
      ],
      recentRefunds: [],
      limit: 50,
    });

    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Refund failed/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry refund' }));
    expect(refundReservation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
    await waitFor(() => {
      expect(refundReservation).toHaveBeenCalledWith(
        '512',
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
  });

  it('hides refund queue and reconcile without can_refund_payments', async () => {
    mockedUseAuth.mockReturnValue(
      authUser({
        roles: ['accountant'],
        permissions: ['can_manage_payments_monitor', 'can_view_revenue'],
      }) as never
    );

    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: 'Refundable bookings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconcile' })).not.toBeInTheDocument();
    expect(getPaymentRefundQueue).not.toHaveBeenCalled();
  });
});
