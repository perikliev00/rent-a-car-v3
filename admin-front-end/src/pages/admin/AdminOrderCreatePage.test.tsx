import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNewOrderForm } from '../../api/admin/orders';
import { getLocations } from '../../api/locations';
import { renderWithRouter } from '../../test/test-utils';
import { AdminOrderCreatePage } from './AdminOrderCreatePage';

vi.mock('../../api/admin/orders', () => ({
  getNewOrderForm: vi.fn(),
  createAdminOrder: vi.fn(),
}));
vi.mock('../../api/locations', () => ({ getLocations: vi.fn() }));

describe('AdminOrderCreatePage', () => {
  beforeEach(() => {
    vi.mocked(getNewOrderForm).mockResolvedValue({
      cars: [],
      defaults: {
        pickupDate: '2026-07-10',
        returnDate: '2026-07-11',
        pickupTime: '10:00',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
      },
    });
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
    });
  });

  it('renders create order form', async () => {
    renderWithRouter(<AdminOrderCreatePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create order' })).toBeInTheDocument();
    });
  });
});
