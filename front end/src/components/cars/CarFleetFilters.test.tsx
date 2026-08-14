import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { CarFleetFilters } from './CarFleetFilters';

const categories = [
  { id: 1, name: 'Economy' },
  { id: 2, name: 'Luxury' },
];

describe('CarFleetFilters', () => {
  it('calls onChange with Automatic when transmission is selected', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <CarFleetFilters categories={categories} value={{}} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('Transmission'), { target: { value: 'Automatic' } });

    expect(onChange).toHaveBeenCalledWith({ transmission: 'Automatic' });
  });

  it('calls onChange with categoryId when a category pill is clicked', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <CarFleetFilters categories={categories} value={{}} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Economy' }));

    expect(onChange).toHaveBeenCalledWith({ categoryId: 1 });
  });

  it('clears advanced filters while keeping category', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <CarFleetFilters
        categories={categories}
        value={{ categoryId: 2, transmission: 'Manual', fuelType: 'Diesel' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onChange).toHaveBeenCalledWith({
      categoryId: 2,
      transmission: undefined,
      fuelType: undefined,
      seatsMin: undefined,
      seatsMax: undefined,
      priceMin: undefined,
      priceMax: undefined,
    });
  });
});
