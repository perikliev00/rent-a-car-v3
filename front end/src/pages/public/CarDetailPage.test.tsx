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
        priceTier_7_31: 30,
        priceTier_31_plus: 25,
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

  it('labels pricing tiers 1–3, 4–31 and 32+ days (matches computeDayPrice)', async () => {
    renderWithRouter(<CarDetailPage />, {
      route: `/cars/1?${buildTestSearchQuery()}`,
      path: '/cars/:carId',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'VW Golf' })).toBeInTheDocument();
    });

    expect(screen.getByText('1–3 days')).toBeInTheDocument();
    expect(screen.getByText('4–31 days')).toBeInTheDocument();
    expect(screen.getByText('32+ days')).toBeInTheDocument();
    expect(screen.queryByText(/7–31/)).not.toBeInTheDocument();
    expect(screen.queryByText('31+ days')).not.toBeInTheDocument();
  });
});