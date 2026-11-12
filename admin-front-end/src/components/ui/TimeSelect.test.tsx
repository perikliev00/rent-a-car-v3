// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './TimeSelect'.
import { TimeSelect } from './TimeSelect';

// Declare a test suite grouping related cases.
describe('TimeSelect', () => {
  // Define a single test case and its expectations.
  it('opens hour/minute columns and updates HH:MM value', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    renderWithRouter(<TimeSelect label="Pickup time" value="10:00" onChange={onChange} />);

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog', { name: /Pickup time picker/i })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: '11' }));
    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith('11:00');

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: '30' }));
    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith('10:30');
  });

  // Define a single test case and its expectations.
  it('closes on Escape', () => {
    renderWithRouter(<TimeSelect label="Pickup time" value="10:00" onChange={vi.fn()} />);

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Call fireEvent.keyDown to perform this step.
    fireEvent.keyDown(document, { key: 'Escape' });
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
