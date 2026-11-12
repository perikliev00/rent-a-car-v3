// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Contribute this line to the enclosing declaration or statement.
import type { Car } from '../../types/api';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './CarCard'.
import { CarCard } from './CarCard';

// Continue the surrounding logic with this statement.
const mockCar: Car = {
  // Provide the id field value.
  id: '1',
  // Provide the name field value.
  name: 'Audi A4',
  // Provide the image field value.
  image: '/cars/audi.jpg',
  // Provide the transmission field value.
  transmission: 'Automatic',
  // Provide the fuel type field value.
  fuelType: 'Diesel',
  // Provide the seats field value.
  seats: 5,
  // Provide the availability field value.
  availability: true,
  // Provide the category field value.
  category: 'Standard',
  // Provide the price tier 1 3 field value.
  priceTier_1_3: 50,
};

// Declare a test suite grouping related cases.
describe('CarCard', () => {
  // Define a single test case and its expectations.
  it('renders car name and details', () => {
    renderWithRouter(<CarCard car={mockCar} detailUrl="/cars/1" />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Audi A4')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Automatic')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('falls back to placeholder when image fails to load', () => {
    renderWithRouter(<CarCard car={mockCar} detailUrl="/cars/1" />);

    // Create the img constant.
    const img = screen.getByRole('img', { name: 'Audi A4' });
    // Call fireEvent.error to perform this step.
    fireEvent.error(img);

    // Assert that the value matches the intended expectation.
    expect(img).toHaveAttribute('src', '/placeholder-car.svg');
  });
});
