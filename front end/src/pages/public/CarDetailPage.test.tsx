import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCar } from '../../api/cars';
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
import { CarDetailPage } from './CarDetailPage';

vi.mock('../../api/cars', () => ({ getCar: vi.fn() }));

describe('CarDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getCar).mockResolvedValue({
      car: {
        id: '1',
        name: 'VW Golf',
        image: '/cars/golf.jpg',
        transmission: 'Manual',
        fuelType: 'Petrol',
        seats: 5,
        availability: true,
        category: 'Economy',
        priceTier_1_3: 35,
      },
    });
  });

  it('renders car details', async () => {
    renderWithRouter(<CarDetailPage />, {
      route: `/cars/1?${buildTestSearchQuery()}`,
      path: '/cars/:carId',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'VW Golf' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Book this car' })).toBeInTheDocument();
  });
});
