import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByText('Your reservation hold has been released.')).toBeInTheDocument();
  });
});
