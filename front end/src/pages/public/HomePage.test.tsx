// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/cars'.
import { getCars } from '../../api/cars';
// Import named exports from '../../api/locations'.
import { getCategories, getLocations } from '../../api/locations';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './HomePage'.
import { HomePage } from './HomePage';

// Call vi.mock to perform this step.
vi.mock('../../api/cars', () => ({ getCars: vi.fn() }));
// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({
  // Provide the get categories field value.
  getCategories: vi.fn(),
  // Provide the get locations field value.
  getLocations: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('HomePage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getCars).mockResolvedValue({
      // Provide the cars field value.
      cars: [],
      // Provide the pagination field value.
      pagination: { currentPage: 1, totalPages: 1 },
      // Provide the pickup date iso field value.
      pickupDateISO: '',
      // Provide the return date iso field value.
      returnDateISO: '',
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
      categories: [
        // Contribute this line to the enclosing declaration or statement.
        { id: 1, name: 'Economy' },
        // Contribute this line to the enclosing declaration or statement.
        { id: 2, name: 'Luxury' },
      ],
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
  it('renders hero and fleet section', async () => {
    renderWithRouter(<HomePage />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Drive Bulgaria in/i)).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Our fleet')).toBeInTheDocument();

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('No cars available at the moment.')).toBeInTheDocument();
    });
  });

  // Define a single test case and its expectations.
  it('renders fleet filters and refetches with transmission', async () => {
    renderWithRouter(<HomePage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByLabelText('Transmission')).toBeInTheDocument();
    });

    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Transmission'), { target: { value: 'Automatic' } });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(getCars).toHaveBeenCalledWith(
        // Call expect.objectContaining to perform this step.
        expect.objectContaining({ transmission: 'Automatic', page: 1 }),
      );
    });
  });
});
