// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/checkout'.
import { checkoutSuccess } from '../../api/checkout';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './CheckoutSuccessPage'.
import { CheckoutSuccessPage } from './CheckoutSuccessPage';

// Call vi.mock to perform this step.
vi.mock('../../api/checkout', () => ({ checkoutSuccess: vi.fn() }));

// Declare a test suite grouping related cases.
describe('CheckoutSuccessPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutSuccess).mockResolvedValue({
      // Provide the title field value.
      title: 'Booking Confirmed',
      // Provide the confirmed field value.
      confirmed: true,
      // Provide the message field value.
      message: 'Thank you for your payment.',
      // Provide the order reference field value.
      orderReference: 'LR-12345',
      // Provide the order id field value.
      orderId: 1,
      // Provide the reservation id field value.
      reservationId: '1',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_test_123',
      // Provide the pickup summary field value.
      pickupSummary: '2026-07-10 10:00 · Office',
      // Provide the booking status field value.
      bookingStatus: 'confirmed',
      // Provide the support email field value.
      supportEmail: 'support@luxride.bg',
      // Provide the support phone field value.
      supportPhone: '+359 888 000 000',
    });
  });

  // Define a single test case and its expectations.
  it('renders success details', async () => {
    renderWithRouter(<CheckoutSuccessPage />, {
      // Provide the route field value.
      route: '/checkout/success?session_id=cs_test_123',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('LR-12345')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows payment verification failure when API errors', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutSuccess).mockRejectedValue(new Error('Payment was not completed.'));

    renderWithRouter(<CheckoutSuccessPage />, {
      // Provide the route field value.
      route: '/checkout/success?session_id=cs_test_fail',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Payment verification failed' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Payment was not completed.')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows processing state when booking is not confirmed yet', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(checkoutSuccess).mockResolvedValue({
      // Provide the title field value.
      title: 'Payment Received',
      // Provide the confirmed field value.
      confirmed: false,
      // Provide the message field value.
      message: 'Your payment was received. We are confirming your booking — this page will refresh automatically.',
      // Provide the order reference field value.
      orderReference: null,
      // Provide the order id field value.
      orderId: null,
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_test_processing',
      // Provide the pickup summary field value.
      pickupSummary: null,
      // Provide the booking status field value.
      bookingStatus: 'processing',
      // Provide the support email field value.
      supportEmail: 'support@luxride.bg',
      // Provide the support phone field value.
      supportPhone: '',
    });

    renderWithRouter(<CheckoutSuccessPage />, {
      // Provide the route field value.
      route: '/checkout/success?session_id=cs_test_processing',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Payment Received' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/confirming your booking/i)).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Status:\s*processing/i)).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows missing session message when session_id is absent', () => {
    renderWithRouter(<CheckoutSuccessPage />, { route: '/checkout/success' });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('No payment session found.')).toBeInTheDocument();
  });
});
