import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { TimeSelect } from './TimeSelect';

describe('TimeSelect', () => {
  it('opens hour/minute columns and updates HH:MM value', () => {
    const onChange = vi.fn();
    renderWithRouter(<TimeSelect label="Pickup time" value="10:00" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    expect(screen.getByRole('dialog', { name: /Pickup time picker/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '11' }));
    expect(onChange).toHaveBeenCalledWith('11:00');

    fireEvent.click(screen.getByRole('button', { name: '30' }));
    expect(onChange).toHaveBeenCalledWith('10:30');
  });

  it('closes on Escape', () => {
    renderWithRouter(<TimeSelect label="Pickup time" value="10:00" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
