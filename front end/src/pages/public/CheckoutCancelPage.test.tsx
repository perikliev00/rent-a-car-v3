// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';
// Import named exports from '../../api/checkout'.
import { checkoutCancel } from '../../api/checkout';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './CheckoutCancelPage'.
import { CheckoutCancelPage } from './CheckoutCancelPage';

// Call vi.mock to perform this step.
vi.mock('../../api/checkout', () => ({ checkoutCancel: vi.fn() }));

// Declare a test suite grouping related cases.
describe('CheckoutCancelPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutCancel).mockResolvedValue({
      // Provide the cancelled field value.
      cancelled: true,
      // Provide the message field value.
      message: 'Your reservation hold has been released.',
      // Provide the support email field value.
      supportEmail: 'support@luxride.bg',
    });
  });

  // Define a single test case and its expectations.
  it('renders cancel message', async () => {
    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Payment cancelled')).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('checkout-cancel-message')).toHaveTextContent(
      // Supply the literal value used by the enclosing expression.
      'Your reservation hold has been released.'
    );
  });

  // Define a single test case and its expectations.
  it('renders noop copy when there is no hold to cancel', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutCancel).mockResolvedValue({
      // Provide the cancelled field value.
      cancelled: false,
      // Provide the message field value.
      message: 'No active reservation hold to cancel. You can start a new search whenever you are ready.',
      // Provide the support email field value.
      supportEmail: 'support@luxride.bg',
    });

    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(
        // Call screen.getByText to perform this step.
        screen.getByText(/No active reservation hold to cancel/i)
      // Continue the surrounding logic with this statement.
      ).toBeInTheDocument();
    });
  });

  // Define a single test case and its expectations.
  it('renders API error or noop copy when cancel request fails', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutCancel).mockRejectedValue(
      // Continue the surrounding logic with this statement.
      new ApiError('FORBIDDEN', 'Access denied.', 403)
    );

    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Access denied.')).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(
      // Call screen.queryByText to perform this step.
      screen.queryByText('Your payment was cancelled and your reservation hold has been released.')
    // Continue the surrounding logic with this statement.
    ).not.toBeInTheDocument();
  });
});
