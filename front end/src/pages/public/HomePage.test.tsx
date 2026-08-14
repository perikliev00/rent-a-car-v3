import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCars } from '../../api/cars';
import { getCategories, getLocations } from '../../api/locations';
import { renderWithRouter } from '../../test/test-utils';
import { HomePage } from './HomePage';

vi.mock('../../api/cars', () => ({ getCars: vi.fn() }));
vi.mock('../../api/locations', () => ({
  getCategories: vi.fn(),
  getLocations: vi.fn(),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(getCars).mockResolvedValue({
      cars: [],
      pagination: { currentPage: 1, totalPages: 1 },
      pickupDateISO: '',
      returnDateISO: '',
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
      categories: [
        { id: 1, name: 'Economy' },
        { id: 2, name: 'Luxury' },
      ],
    });
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });
  });

  it('renders hero and fleet section', async () => {
    renderWithRouter(<HomePage />);

    expect(screen.getByText(/Drive Bulgaria in/i)).toBeInTheDocument();
    expect(screen.getByText('Our fleet')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No cars available at the moment.')).toBeInTheDocument();
    });
  });

  it('renders fleet filters and refetches with transmission', async () => {
    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Transmission')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Transmission'), { target: { value: 'Automatic' } });

    await waitFor(() => {
      expect(getCars).toHaveBeenCalledWith(
        expect.objectContaining({ transmission: 'Automatic', page: 1 }),
      );
    });
  });
});
