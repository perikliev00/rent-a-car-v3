// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/locations'.
import { getLocations } from '../../api/locations';
// Import named exports from '../../utils/searchParams'.
import { defaultSearchParams } from '../../utils/searchParams';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './SearchForm'.
import { SearchForm } from './SearchForm';

// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({
  // Provide the get locations field value.
  getLocations: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('SearchForm', () => {
  // Define a single test case and its expectations.
  it('renders search fields and submits', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
      // Provide the delivery fees field value.
      deliveryFees: {} as never,
      // Provide the return fees field value.
      returnFees: {} as never,
    });

    // Create the on submit constant.
    const onSubmit = vi.fn();
    // Create the values constant.
    const values = defaultSearchParams();

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <SearchForm values={values} onChange={vi.fn()} onSubmit={onSubmit} />,
    );

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(getLocations).toHaveBeenCalled();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Pickup date')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Return date')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: /Pickup time/i })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: /Pickup location/i })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Get your quote' })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Get your quote' }));
    // Assert that the value matches the intended expectation.
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Define a single test case and its expectations.
  it('updates pickup date via calendar and keeps return on or after pickup', () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
      // Provide the delivery fees field value.
      deliveryFees: {} as never,
      // Provide the return fees field value.
      returnFees: {} as never,
    });

    // Create the on change constant.
    const onChange = vi.fn();
    // Create the values constant.
    const values = {
      // Call ...defaultSearchParams to perform this step.
      ...defaultSearchParams(),
      // Provide the pickup date field value.
      pickupDate: '2030-06-10',
      // Provide the return date field value.
      returnDate: '2030-06-14',
    };

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <SearchForm values={values} onChange={onChange} onSubmit={vi.fn()} />,
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByLabelText('Pickup date'));
    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: '2030-06-12' }));

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ pickupDate: '2030-06-12', returnDate: '2030-06-14' }),
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByLabelText('Return date'));
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: '2030-06-09' })).toBeDisabled();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: '2030-06-10' })).not.toBeDisabled();
  });

  // Define a single test case and its expectations.
  it('updates location and time via custom dropdowns', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [
        // Contribute this line to the enclosing declaration or statement.
        { id: 'office', label: 'Office' },
        // Contribute this line to the enclosing declaration or statement.
        { id: 'sveti-vlas', label: 'Sveti Vlas' },
      ],
      // Provide the delivery fees field value.
      deliveryFees: {} as never,
      // Provide the return fees field value.
      returnFees: {} as never,
    });

    // Create the on change constant.
    const onChange = vi.fn();
    // Create the values constant.
    const values = defaultSearchParams();

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <SearchForm values={values} onChange={onChange} onSubmit={vi.fn()} />,
    );

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('button', { name: /Pickup location/i })).toHaveTextContent('Office');
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup location/i }));
    // Call fireEvent.click to perform this step.
    fireEvent.click(await screen.findByRole('option', { name: 'Sveti Vlas' }));

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ pickupLocation: 'sveti-vlas' }),
    );

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: /Pickup time/i }));
    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: '11' }));

    // Assert that the value matches the intended expectation.
    expect(onChange).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ pickupTime: '11:00' }),
    );
  });

  // Define a single test case and its expectations.
  it('does not submit when loading', () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
      // Provide the delivery fees field value.
      deliveryFees: {} as never,
      // Provide the return fees field value.
      returnFees: {} as never,
    });

    // Create the on submit constant.
    const onSubmit = vi.fn();
    // Create the values constant.
    const values = defaultSearchParams();

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <SearchForm values={values} onChange={vi.fn()} onSubmit={onSubmit} loading />,
    );

    // Create the button constant.
    const button = screen.getByRole('button', { name: 'Get your quote' });
    // Assert that the value matches the intended expectation.
    expect(button).toBeDisabled();
  });
});
