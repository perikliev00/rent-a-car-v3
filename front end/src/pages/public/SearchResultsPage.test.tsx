// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/cars'.
import { searchCars } from '../../api/cars';
// Import named exports from '../../api/locations'.
import { getCategories, getLocations } from '../../api/locations';
// Import named exports from '../../test/test-utils'.
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
// Import named exports from './SearchResultsPage'.
import { SearchResultsPage } from './SearchResultsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/cars', () => ({ searchCars: vi.fn() }));
// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({
  // Provide the get categories field value.
  getCategories: vi.fn(),
  // Provide the get locations field value.
  getLocations: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('SearchResultsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(searchCars).mockResolvedValue({
      // Provide the cars field value.
      cars: [],
      // Provide the rental days field value.
      rentalDays: 1,
      // Provide the pagination field value.
      pagination: { currentPage: 1, totalPages: 1 },
      // Provide the search field value.
      search: {
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pickup date field value.
        pickupDate: '2026-08-01',
        // Provide the return date field value.
        returnDate: '2026-08-02',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
      },
      // Provide the delivery price field value.
      deliveryPrice: 0,
      // Provide the return price field value.
      returnPrice: 0,
      // Provide the category id field value.
      categoryId: null,
      // Provide the filters field value.
      filters: {
        // Provide the category id field value.
        categoryId: '',
        // Provide the transmission field value.
        transmission: '',
        // Provide the fuel type field value.
        fuelType: '',
        // Provide the price min field value.
        priceMin: '',
        // Provide the price max field value.
        priceMax: '',
        // Provide the seats min field value.
        seatsMin: '',
        // Provide the seats max field value.
        seatsMax: '',
      },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getCategories).mockResolvedValue({
      // Provide the categories field value.
      categories: [{ id: 3, name: 'SUV' }],
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
      // Provide the delivery fees field value.
      deliveryFees: {} as never,
      // Provide the return fees field value.
      returnFees: {} as never,
    });
  });

  // Define a single test case and its expectations.
  it('renders search results heading', async () => {
    renderWithRouter(<SearchResultsPage />, { route: `/search?${buildTestSearchQuery()}` });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Available cars')).toBeInTheDocument();

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('No cars available')).toBeInTheDocument();
    });
  });

  // Define a single test case and its expectations.
  it('passes URL fleet filters to searchCars', async () => {
    // Create the qs constant.
    const qs = `${buildTestSearchQuery()}&categoryId=3&transmission=Automatic&fuelType=Petrol`;
    renderWithRouter(<SearchResultsPage />, { route: `/search?${qs}` });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(searchCars).toHaveBeenCalledWith(
        // Call expect.any to perform this step.
        expect.any(Object),
        // Call expect.objectContaining to perform this step.
        expect.objectContaining({
          // Provide the category id field value.
          categoryId: 3,
          // Provide the transmission field value.
          transmission: 'Automatic',
          // Provide the fuel type field value.
          fuelType: 'Petrol',
          // Provide the page field value.
          page: 1,
        }),
      );
    });
  });
});
