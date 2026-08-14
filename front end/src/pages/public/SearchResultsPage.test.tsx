import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCars } from '../../api/cars';
import { getCategories, getLocations } from '../../api/locations';
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
import { SearchResultsPage } from './SearchResultsPage';

vi.mock('../../api/cars', () => ({ searchCars: vi.fn() }));
vi.mock('../../api/locations', () => ({
  getCategories: vi.fn(),
  getLocations: vi.fn(),
}));

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.mocked(searchCars).mockResolvedValue({
      cars: [],
      rentalDays: 1,
      pagination: { currentPage: 1, totalPages: 1 },
      search: {
        pickupLocation: 'office',
        returnLocation: 'office',
        pickupDate: '2026-08-01',
        returnDate: '2026-08-02',
        pickupTime: '10:00',
        returnTime: '10:00',
      },
      deliveryPrice: 0,
      returnPrice: 0,
      categoryId: null,
      filters: {
        categoryId: '',
        transmission: '',
        fuelType: '',
        priceMin: '',
        priceMax: '',
        seatsMin: '',
        seatsMax: '',
      },
    });
    vi.mocked(getCategories).mockResolvedValue({
      categories: [{ id: 3, name: 'SUV' }],
    });
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });
  });

  it('renders search results heading', async () => {
    renderWithRouter(<SearchResultsPage />, { route: `/search?${buildTestSearchQuery()}` });

    expect(screen.getByText('Available cars')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No cars available')).toBeInTheDocument();
    });
  });

  it('passes URL fleet filters to searchCars', async () => {
    const qs = `${buildTestSearchQuery()}&categoryId=3&transmission=Automatic&fuelType=Petrol`;
    renderWithRouter(<SearchResultsPage />, { route: `/search?${qs}` });

    await waitFor(() => {
      expect(searchCars).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          categoryId: 3,
          transmission: 'Automatic',
          fuelType: 'Petrol',
          page: 1,
        }),
      );
    });
  });
});
