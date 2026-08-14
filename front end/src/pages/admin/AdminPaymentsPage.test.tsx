import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPayments } from '../../api/admin/payments';
import { renderWithRouter } from '../../test/test-utils';
import { AdminPaymentsPage } from './AdminPaymentsPage';

vi.mock('../../api/admin/payments', () => ({
  getPayments: vi.fn(),
  reconcilePayments: vi.fn(),
}));

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.mocked(getPayments).mockResolvedValue({
      events: [],
      failures: [],
      unresolvedFailureCount: 0,
    });
  });

  it('renders payments page', async () => {
    renderWithRouter(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reconcile' })).toBeInTheDocument();
  });
});
