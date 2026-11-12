// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './DateSelect'.
import { DateSelect } from './DateSelect';

// Declare a test suite grouping related cases.
describe('DateSelect', () => {
  // Define a single test case and its expectations.
  it('opens calendar and selects a date', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <DateSelect label="Pickup date" value="2030-06-10" onChange={onChange} min="2030-06-01" />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup date/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog', { name: /Pickup date picker/i })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: '2030-06-15' }));
    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith('2030-06-15');
  });

  // Define a single test case and its expectations.
  it('navigates to the next month without resetting', () => {
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <DateSelect label="Pickup date" value="2030-06-10" onChange={vi.fn()} min="2030-06-01" />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup date/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('June 2030')).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('July 2030')).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('August 2030')).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('July 2030')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('disables dates before min', () => {
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <DateSelect label="Return date" value="2030-06-10" onChange={vi.fn()} min="2030-06-10" />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Return date/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: '2030-06-09' })).toBeDisabled();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: '2030-06-10' })).not.toBeDisabled();
  });
});
