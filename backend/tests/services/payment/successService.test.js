jest.mock('../../../src/services/payment/stripeCheckoutService', () => ({
  retrieveStripeCheckoutSession: jest.fn(),
}));
jest.mock('../../../src/services/sql/orderSqlService', () => ({
  findOrderByStripeSessionId: jest.fn(),
}));
jest.mock('../../../src/services/bookingFinalizationService', () => ({
  finalizeReservationByStripeSessionId: jest.fn(),
}));
jest.mock('../../../src/repositories/reservationRepository', () => ({
  findByStripeSessionId: jest.fn(),
}));
jest.mock('../../../src/monitoring/track', () => ({
  trackPaymentFailure: jest.fn(),
}));

const { retrieveStripeCheckoutSession } = require('../../../src/services/payment/stripeCheckoutService');
const orderSql = require('../../../src/services/sql/orderSqlService');
const { finalizeReservationByStripeSessionId } = require('../../../src/services/bookingFinalizationService');
const { handleCheckoutSuccessFlow } = require('../../../src/services/payment/successService');

describe('handleCheckoutSuccessFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderSql.findOrderByStripeSessionId.mockReset();
    finalizeReservationByStripeSessionId.mockReset();
    retrieveStripeCheckoutSession.mockReset();
  });

  test('throws when session_id is missing', async () => {
    await expect(handleCheckoutSuccessFlow({ query: {} })).rejects.toMatchObject({
      message: 'Invalid checkout session.',
    });
  });

  test('throws when payment is not completed', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_status: 'unpaid',
      metadata: {},
    });

    await expect(
      handleCheckoutSuccessFlow({ query: { session_id: 'cs_test_abc' }, requestId: 'req-1' })
    ).rejects.toMatchObject({
      message: 'Payment was not completed.',
    });
  });

  test('returns confirmed payload when order already exists', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_status: 'paid',
      metadata: {},
    });
    orderSql.findOrderByStripeSessionId.mockResolvedValue({ id: 42 });

    const result = await handleCheckoutSuccessFlow({
      query: { session_id: 'cs_test_abc' },
      requestId: 'req-1',
    });

    expect(result.confirmed).toBe(true);
    expect(result.orderReference).toBe('#42');
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  test('finalizes paid session when no order exists yet (success before webhook)', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
      client_reference_id: '42',
      metadata: {
        reservationId: '42',
        carId: '7',
        sessionId: 'sess_abc',
      },
    });
    orderSql.findOrderByStripeSessionId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 99, pickupDate: new Date('2030-06-01'), pickupLocation: 'office' });
    finalizeReservationByStripeSessionId.mockResolvedValue({
      found: true,
      finalized: true,
      reason: 'finalized',
      order: { id: 99, pickupDate: new Date('2030-06-01'), pickupLocation: 'office' },
      reservation: { id: 42, status: 'confirmed' },
    });

    const result = await handleCheckoutSuccessFlow({
      query: { session_id: 'cs_test_success_first' },
      requestId: 'req-success-first',
    });

    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledWith(
      'cs_test_success_first',
      expect.objectContaining({
        reservationId: '42',
        carId: '7',
        sessionId: 'sess_abc',
        stripeSessionPaymentStatus: 'paid',
        stripeSessionAmountTotal: 12000,
        stripeSessionCurrency: 'eur',
      })
    );
    expect(result.confirmed).toBe(true);
    expect(result.bookingStatus).toBe('confirmed');
    expect(result.orderReference).toBe('#99');
    expect(result.title).toBe('Booking Confirmed');
  });

  test('returns processing payload when finalize does not confirm yet', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_status: 'paid',
      metadata: { reservationId: '42' },
    });
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    finalizeReservationByStripeSessionId.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'overlap_after_payment',
      reservation: { id: 42, status: 'manual_review' },
    });

    const result = await handleCheckoutSuccessFlow({
      query: { session_id: 'cs_test_pending' },
      requestId: 'req-pending',
    });

    expect(result.confirmed).toBe(false);
    expect(result.bookingStatus).toBe('manual_review');
    expect(result.title).toBe('Payment Received');
    expect(result.reservationId).toBe(42);
  });
});
