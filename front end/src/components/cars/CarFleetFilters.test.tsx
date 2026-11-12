// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './CarFleetFilters'.
import { CarFleetFilters } from './CarFleetFilters';

// Create the categories constant.
const categories = [
  // Contribute this line to the enclosing declaration or statement.
  { id: 1, name: 'Economy' },
  // Contribute this line to the enclosing declaration or statement.
  { id: 2, name: 'Luxury' },
];

// Declare a test suite grouping related cases.
describe('CarFleetFilters', () => {
  // Define a single test case and its expectations.
  it('calls onChange with Automatic when transmission is selected', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <CarFleetFilters categories={categories} value={{}} onChange={onChange} />,
    );

    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Transmission'), { target: { value: 'Automatic' } });

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith({ transmission: 'Automatic' });
  });

  // Define a single test case and its expectations.
  it('calls onChange with categoryId when a category pill is clicked', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <CarFleetFilters categories={categories} value={{}} onChange={onChange} />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Economy' }));

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith({ categoryId: 1 });
  });

  // Define a single test case and its expectations.
  it('clears advanced filters while keeping category', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <CarFleetFilters
        categories={categories}
        value={{ categoryId: 2, transmission: 'Manual', fuelType: 'Diesel' }}
        onChange={onChange}
      />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith({
      // Provide the category id field value.
      categoryId: 2,
      // Provide the transmission field value.
      transmission: undefined,
      // Provide the fuel type field value.
      fuelType: undefined,
      // Provide the seats min field value.
      seatsMin: undefined,
      // Provide the seats max field value.
      seatsMax: undefined,
      // Provide the price min field value.
      priceMin: undefined,
      // Provide the price max field value.
      priceMax: undefined,
    });
  });
});
