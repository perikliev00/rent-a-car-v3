// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './DropdownSelect'.
import { DropdownSelect } from './DropdownSelect';

// Create the options constant.
const options = [
  // Contribute this line to the enclosing declaration or statement.
  { value: 'office', label: 'Office' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'sveti-vlas', label: 'Sveti Vlas' },
];

// Declare a test suite grouping related cases.
describe('DropdownSelect', () => {
  // Define a single test case and its expectations.
  it('opens options and calls onChange when an item is selected', () => {
    // Create the on change constant.
    const onChange = vi.fn();
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <DropdownSelect label="Pickup location" value="office" options={options} onChange={onChange} />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('option', { name: 'Sveti Vlas' })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('option', { name: 'Sveti Vlas' }));
    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith('sveti-vlas');
  });

  // Define a single test case and its expectations.
  it('closes on Escape', () => {
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <DropdownSelect label="Pickup location" value="office" options={options} onChange={vi.fn()} />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Call fireEvent.keyDown to perform this step.
    fireEvent.keyDown(document, { key: 'Escape' });
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
