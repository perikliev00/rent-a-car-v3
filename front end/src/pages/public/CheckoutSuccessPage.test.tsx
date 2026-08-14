import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutSuccess } from '../../api/checkout';
import { renderWithRouter } from '../../test/test-utils';
import { CheckoutSuccessPage } from './CheckoutSuccessPage';

vi.mock('../../api/checkout', () => ({ checkoutSuccess: vi.fn() }));

describe('CheckoutSuccessPage', () => {
  beforeEach(() => {
    vi.mocked(checkoutSuccess).mockResolvedValue({
      title: 'Booking Confirmed',
      confirmed: true,
      message: 'Thank you for your payment.',
      orderReference: 'LR-12345',
      orderId: 1,
      reservationId: '1',
      stripeSessionId: 'cs_test_123',
      pickupSummary: '2026-07-10 10:00 · Office',
      bookingStatus: 'confirmed',
      supportEmail: 'support@luxride.bg',
      supportPhone: '+359 888 000 000',
    });
  });

  it('renders success details', async () => {
    renderWithRouter(<CheckoutSuccessPage />, {
      route: '/checkout/success?session_id=cs_test_123',
    });

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
    });

    expect(screen.getByText('LR-12345')).toBeInTheDocument();
  });

  it('shows payment verification failure when API errors', async () => {
    vi.mocked(checkoutSuccess).mockRejectedValue(new Error('Payment was not completed.'));

    renderWithRouter(<CheckoutSuccessPage />, {
      route: '/checkout/success?session_id=cs_test_fail',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Payment verification failed' })).toBeInTheDocument();
    });

    expect(screen.getByText('Payment was not completed.')).toBeInTheDocument();
  });

  it('shows processing state when booking is not confirmed yet', async () => {
    vi.mocked(checkoutSuccess).mockResolvedValue({
      title: 'Payment Received',
      confirmed: false,
      message: 'Your payment was received. We are confirming your booking — this page will refresh automatically.',
      orderReference: null,
      orderId: null,
      reservationId: '42',
      stripeSessionId: 'cs_test_processing',
      pickupSummary: null,
      bookingStatus: 'processing',
      supportEmail: 'support@luxride.bg',
      supportPhone: '',
    });

    renderWithRouter(<CheckoutSuccessPage />, {
      route: '/checkout/success?session_id=cs_test_processing',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Payment Received' })).toBeInTheDocument();
    });

    expect(screen.getByText(/confirming your booking/i)).toBeInTheDocument();
    expect(screen.getByText(/Status:\s*processing/i)).toBeInTheDocument();
  });

  it('shows missing session message when session_id is absent', () => {
    renderWithRouter(<CheckoutSuccessPage />, { route: '/checkout/success' });

    expect(screen.getByText('No payment session found.')).toBeInTheDocument();
  });
});
