// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/cars'.
import { getAdminCars } from '../../api/admin/cars';
// Import named exports from '../../api/locations'.
import { getCategories } from '../../api/locations';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminCarsPage'.
import { AdminCarsPage } from './AdminCarsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({
  // Provide the get admin cars field value.
  getAdminCars: vi.fn(),
  // Provide the create admin car field value.
  createAdminCar: vi.fn(),
  // Provide the update admin car field value.
  updateAdminCar: vi.fn(),
  // Provide the delete admin car field value.
  deleteAdminCar: vi.fn(),
  // Provide the fuel level options field value.
  FUEL_LEVEL_OPTIONS: [
    // Contribute this line to the enclosing declaration or statement.
    { value: '', label: '—' },
    // Contribute this line to the enclosing declaration or statement.
    { value: 'full', label: 'Full' },
  ],
}));
// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({ getCategories: vi.fn() }));

// Declare a test suite grouping related cases.
describe('AdminCarsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminCars).mockResolvedValue({
      // Provide the cars field value.
      cars: [
        {
          // Provide the id field value.
          id: '1',
          // Provide the name field value.
          name: 'Test Car',
          // Provide the image field value.
          image: '/img.jpg',
          // Provide the transmission field value.
          transmission: 'Automatic',
          // Provide the fuel type field value.
          fuelType: 'Petrol',
          // Provide the seats field value.
          seats: 5,
          // Provide the availability field value.
          availability: true,
          // Provide the status field value.
          status: 'available',
          // Provide the category field value.
          category: 'Economy',
          // Provide the price tier 1 3 field value.
          priceTier_1_3: 40,
        },
      ],
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getCategories).mockResolvedValue({ categories: [] });
  });

  // Define a single test case and its expectations.
  it('renders cars management page', async () => {
    renderWithRouter(<AdminCarsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Cars' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Add car' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('available')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/admin/cars/1');
  });
});
