import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { checkoutCancel } from '../../api/checkout';
import { renderWithRouter } from '../../test/test-utils';
import { CheckoutCancelPage } from './CheckoutCancelPage';

vi.mock('../../api/checkout', () => ({ checkoutCancel: vi.fn() }));

describe('CheckoutCancelPage', () => {
  beforeEach(() => {
    vi.mocked(checkoutCancel).mockResolvedValue({
      cancelled: true,
      message: 'Your reservation hold has been released.',
      supportEmail: 'support@luxride.bg',
    });
  });

  it('renders cancel message', async () => {
    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    await waitFor(() => {
      expect(screen.getByText('Payment cancelled')).toBeInTheDocument();
    });

    expect(screen.getByTestId('checkout-cancel-message')).toHaveTextContent(
      'Your reservation hold has been released.'
    );
  });

  it('renders noop copy when there is no hold to cancel', async () => {
    vi.mocked(checkoutCancel).mockResolvedValue({
      cancelled: false,
      message: 'No active reservation hold to cancel. You can start a new search whenever you are ready.',
      supportEmail: 'support@luxride.bg',
    });

    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    await waitFor(() => {
      expect(
        screen.getByText(/No active reservation hold to cancel/i)
      ).toBeInTheDocument();
    });
  });

  it('renders API error or noop copy when cancel request fails', async () => {
    vi.mocked(checkoutCancel).mockRejectedValue(
      new ApiError('FORBIDDEN', 'Access denied.', 403)
    );

    renderWithRouter(<CheckoutCancelPage />, { route: '/checkout/cancel' });

    await waitFor(() => {
      expect(screen.getByText('Access denied.')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Your payment was cancelled and your reservation hold has been released.')
    ).not.toBeInTheDocument();
  });
});
