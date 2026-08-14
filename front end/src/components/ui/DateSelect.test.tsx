import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { DateSelect } from './DateSelect';

describe('DateSelect', () => {
  it('opens calendar and selects a date', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <DateSelect label="Pickup date" value="2030-06-10" onChange={onChange} min="2030-06-01" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pickup date/i }));
    expect(screen.getByRole('dialog', { name: /Pickup date picker/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2030-06-15' }));
    expect(onChange).toHaveBeenCalledWith('2030-06-15');
  });

  it('navigates to the next month without resetting', () => {
    renderWithRouter(
      <DateSelect label="Pickup date" value="2030-06-10" onChange={vi.fn()} min="2030-06-01" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pickup date/i }));
    expect(screen.getByText('June 2030')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('July 2030')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('August 2030')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('July 2030')).toBeInTheDocument();
  });

  it('disables dates before min', () => {
    renderWithRouter(
      <DateSelect label="Return date" value="2030-06-10" onChange={vi.fn()} min="2030-06-10" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Return date/i }));
    expect(screen.getByRole('button', { name: '2030-06-09' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2030-06-10' })).not.toBeDisabled();
  });
});
