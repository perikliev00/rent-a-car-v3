import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminOrders,
  getDeletedOrders,
  getExpiredOrders,
} from '../../api/admin/orders';
import { renderWithRouter } from '../../test/test-utils';
import { AdminOrdersPage } from './AdminOrdersPage';

vi.mock('../../api/admin/orders', () => ({
  getAdminOrders: vi.fn(),
  getDeletedOrders: vi.fn(),
  getExpiredOrders: vi.fn(),
  deleteAdminOrder: vi.fn(),
  restoreAdminOrder: vi.fn(),
  emptyDeletedOrders: vi.fn(),
}));

describe('AdminOrdersPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminOrders).mockResolvedValue({
      orders: [],
      filters: { status: '', startDate: '', endDate: '', search: '' },
    });
    vi.mocked(getDeletedOrders).mockResolvedValue({ orders: [] });
    vi.mocked(getExpiredOrders).mockResolvedValue({ orders: [] });
  });

  it('renders orders management page', async () => {
    renderWithRouter(<AdminOrdersPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Create order' })).toBeInTheDocument();
  });
});
