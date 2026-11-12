import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Car } from '../../types/api';
import { renderWithRouter } from '../../test/test-utils';
import { CarCard } from './CarCard';

const mockCar: Car = {
  id: '1',
  name: 'Audi A4',
  image: '/cars/audi.jpg',
  transmission: 'Automatic',
  fuelType: 'Diesel',
  seats: 5,
  availability: true,
  category: 'Standard',
  priceTier_1_3: 50,
};

describe('CarCard', () => {
  it('renders car name and details', () => {
    renderWithRouter(<CarCard car={mockCar} detailUrl="/cars/1" />);

    expect(screen.getByText('Audi A4')).toBeInTheDocument();
    expect(screen.getByText('Automatic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  it('falls back to placeholder when image fails to load', () => {
    renderWithRouter(<CarCard car={mockCar} detailUrl="/cars/1" />);

    const img = screen.getByRole('img', { name: 'Audi A4' });
    fireEvent.error(img);

    expect(img).toHaveAttribute('src', '/placeholder-car.svg');
  });
});
