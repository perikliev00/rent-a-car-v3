import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminCars } from '../../api/admin/cars';
import { getCategories } from '../../api/locations';
import { renderWithRouter } from '../../test/test-utils';
import { AdminCarsPage } from './AdminCarsPage';

vi.mock('../../api/admin/cars', () => ({
  getAdminCars: vi.fn(),
  createAdminCar: vi.fn(),
  updateAdminCar: vi.fn(),
  deleteAdminCar: vi.fn(),
  FUEL_LEVEL_OPTIONS: [
    { value: '', label: '—' },
    { value: 'full', label: 'Full' },
  ],
}));
vi.mock('../../api/locations', () => ({ getCategories: vi.fn() }));

describe('AdminCarsPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminCars).mockResolvedValue({
      cars: [
        {
          id: '1',
          name: 'Test Car',
          image: '/img.jpg',
          transmission: 'Automatic',
          fuelType: 'Petrol',
          seats: 5,
          availability: true,
          status: 'available',
          category: 'Economy',
          priceTier_1_3: 40,
        },
      ],
    });
    vi.mocked(getCategories).mockResolvedValue({ categories: [] });
  });

  it('renders cars management page', async () => {
    renderWithRouter(<AdminCarsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cars' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Add car' })).toBeInTheDocument();
    expect(screen.getByText('available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/admin/cars/1');
  });
});
