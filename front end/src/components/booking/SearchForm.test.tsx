import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getLocations } from '../../api/locations';
import { defaultSearchParams } from '../../utils/searchParams';
import { renderWithRouter } from '../../test/test-utils';
import { SearchForm } from './SearchForm';

vi.mock('../../api/locations', () => ({
  getLocations: vi.fn(),
}));

describe('SearchForm', () => {
  it('renders search fields and submits', async () => {
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });

    const onSubmit = vi.fn();
    const values = defaultSearchParams();

    renderWithRouter(
      <SearchForm values={values} onChange={vi.fn()} onSubmit={onSubmit} />,
    );

    expect(screen.getByLabelText('Pickup date')).toBeInTheDocument();
    expect(screen.getByLabelText('Return date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pickup time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pickup location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get your quote' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Get your quote' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(getLocations).toHaveBeenCalled();
    });
  });

  it('updates pickup date via calendar and keeps return on or after pickup', () => {
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });

    const onChange = vi.fn();
    const values = {
      ...defaultSearchParams(),
      pickupDate: '2030-06-10',
      returnDate: '2030-06-14',
    };

    renderWithRouter(
      <SearchForm values={values} onChange={onChange} onSubmit={vi.fn()} />,
    );

    fireEvent.click(screen.getByLabelText('Pickup date'));
    fireEvent.click(screen.getByRole('button', { name: '2030-06-12' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pickupDate: '2030-06-12', returnDate: '2030-06-14' }),
    );

    fireEvent.click(screen.getByLabelText('Return date'));
    expect(screen.getByRole('button', { name: '2030-06-09' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2030-06-10' })).not.toBeDisabled();
  });

  it('updates location and time via custom dropdowns', async () => {
    vi.mocked(getLocations).mockResolvedValue({
      locations: [
        { id: 'office', label: 'Office' },
        { id: 'sveti-vlas', label: 'Sveti Vlas' },
      ],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });

    const onChange = vi.fn();
    const values = defaultSearchParams();

    renderWithRouter(
      <SearchForm values={values} onChange={onChange} onSubmit={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pickup location/i })).toHaveTextContent('Office');
    });

    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Sveti Vlas' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pickupLocation: 'sveti-vlas' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    fireEvent.click(screen.getByRole('button', { name: '11' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pickupTime: '11:00' }),
    );
  });

  it('does not submit when loading', () => {
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
      deliveryFees: {} as never,
      returnFees: {} as never,
    });

    const onSubmit = vi.fn();
    const values = defaultSearchParams();

    renderWithRouter(
      <SearchForm values={values} onChange={vi.fn()} onSubmit={onSubmit} loading />,
    );

    const button = screen.getByRole('button', { name: 'Get your quote' });
    expect(button).toBeDisabled();
  });
});
