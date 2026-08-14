import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { DropdownSelect } from './DropdownSelect';

const options = [
  { value: 'office', label: 'Office' },
  { value: 'sveti-vlas', label: 'Sveti Vlas' },
];

describe('DropdownSelect', () => {
  it('opens options and calls onChange when an item is selected', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <DropdownSelect label="Pickup location" value="office" options={options} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    expect(screen.getByRole('option', { name: 'Sveti Vlas' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Sveti Vlas' }));
    expect(onChange).toHaveBeenCalledWith('sveti-vlas');
  });

  it('closes on Escape', () => {
    renderWithRouter(
      <DropdownSelect label="Pickup location" value="office" options={options} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
