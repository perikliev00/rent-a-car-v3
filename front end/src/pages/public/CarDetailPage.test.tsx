// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/cars'.
import { getCar } from '../../api/cars';
// Import named exports from '../../test/test-utils'.
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
// Import named exports from './CarDetailPage'.
import { CarDetailPage } from './CarDetailPage';

// Call vi.mock to perform this step.
vi.mock('../../api/cars', () => ({ getCar: vi.fn() }));

// Declare a test suite grouping related cases.
describe('CarDetailPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getCar).mockResolvedValue({
      // Provide the car field value.
      car: {
        // Provide the id field value.
        id: '1',
        // Provide the name field value.
        name: 'VW Golf',
        // Provide the image field value.
        image: '/cars/golf.jpg',
        // Provide the transmission field value.
        transmission: 'Manual',
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the seats field value.
        seats: 5,
        // Provide the availability field value.
        availability: true,
        // Provide the category field value.
        category: 'Economy',
        // Provide the price tier 1 3 field value.
        priceTier_1_3: 35,
      },
    });
  });

  // Define a single test case and its expectations.
  it('renders car details', async () => {
    renderWithRouter(<CarDetailPage />, {
      // Provide the route field value.
      route: `/cars/1?${buildTestSearchQuery()}`,
      // Provide the path field value.
      path: '/cars/:carId',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'VW Golf' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Book this car' })).toBeInTheDocument();
  });
});
