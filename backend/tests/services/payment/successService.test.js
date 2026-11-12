// Call jest.mock to perform this step.
jest.mock('../../../src/services/payment/stripeCheckoutService', () => ({
  // Provide the retrieve stripe checkout session field value.
  retrieveStripeCheckoutSession: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/orderSqlService', () => ({
  // Provide the find order by stripe session id field value.
  findOrderByStripeSessionId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/bookingFinalizationService', () => ({
  // Provide the finalize reservation by stripe session id field value.
  finalizeReservationByStripeSessionId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/repositories/reservationRepository', () => ({
  // Provide the find by stripe session id field value.
  findByStripeSessionId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/monitoring/track', () => ({
  // Provide the track payment failure field value.
  trackPaymentFailure: jest.fn(),
}));

// Destructure object properties into local variables.
const { retrieveStripeCheckoutSession } = require('../../../src/services/payment/stripeCheckoutService');
// Require the '../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../src/services/sql/orderSqlService');
// Destructure object properties into local variables.
const { finalizeReservationByStripeSessionId } = require('../../../src/services/bookingFinalizationService');
// Destructure object properties into local variables.
const { handleCheckoutSuccessFlow } = require('../../../src/services/payment/successService');

// Declare a test suite grouping related cases.
describe('handleCheckoutSuccessFlow', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderSql.findOrderByStripeSessionId.mockReset to perform this step.
    orderSql.findOrderByStripeSessionId.mockReset();
    // Call finalizeReservationByStripeSessionId.mockReset to perform this step.
    finalizeReservationByStripeSessionId.mockReset();
    // Call retrieveStripeCheckoutSession.mockReset to perform this step.
    retrieveStripeCheckoutSession.mockReset();
  });

  // Define a single test case and its expectations.
  test('throws when session_id is missing', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(handleCheckoutSuccessFlow({ query: {} })).rejects.toMatchObject({
      // Provide the message field value.
      message: 'Invalid checkout session.',
    });
  });

  // Define a single test case and its expectations.
  test('throws when payment is not completed', async () => {
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'unpaid',
      // Provide the metadata field value.
      metadata: {},
    });

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call handleCheckoutSuccessFlow to perform this step.
      handleCheckoutSuccessFlow({ query: { session_id: 'cs_test_abc' }, requestId: 'req-1' })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the message field value.
      message: 'Payment was not completed.',
    });
  });

  // Define a single test case and its expectations.
  test('returns confirmed payload when order already exists', async () => {
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the metadata field value.
      metadata: {},
    });
    // Call orderSql.findOrderByStripeSessionId.mockResolvedValue to perform this step.
    orderSql.findOrderByStripeSessionId.mockResolvedValue({ id: 42 });

    // Create the result constant.
    const result = await handleCheckoutSuccessFlow({
      // Provide the query field value.
      query: { session_id: 'cs_test_abc' },
      // Provide the request id field value.
      requestId: 'req-1',
    });

    // Assert that the value matches the intended expectation.
    expect(result.confirmed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.orderReference).toBe('#42');
    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('finalizes paid session when no order exists yet (success before webhook)', async () => {
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the client reference id field value.
      client_reference_id: '42',
      // Provide the metadata field value.
      metadata: {
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the car id field value.
        carId: '7',
        // Provide the session id field value.
        sessionId: 'sess_abc',
      },
    });
    // Contribute this line to the enclosing declaration or statement.
    orderSql.findOrderByStripeSessionId
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ id: 99, pickupDate: new Date('2030-06-01'), pickupLocation: 'office' });
    // Call finalizeReservationByStripeSessionId.mockResolvedValue to perform this step.
    finalizeReservationByStripeSessionId.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: true,
      // Provide the reason field value.
      reason: 'finalized',
      // Provide the order field value.
      order: { id: 99, pickupDate: new Date('2030-06-01'), pickupLocation: 'office' },
      // Provide the reservation field value.
      reservation: { id: 42, status: 'confirmed' },
    });

    // Create the result constant.
    const result = await handleCheckoutSuccessFlow({
      // Provide the query field value.
      query: { session_id: 'cs_test_success_first' },
      // Provide the request id field value.
      requestId: 'req-success-first',
    });

    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'cs_test_success_first',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the car id field value.
        carId: '7',
        // Provide the session id field value.
        sessionId: 'sess_abc',
        // Provide the stripe session payment status field value.
        stripeSessionPaymentStatus: 'paid',
        // Provide the stripe session amount total field value.
        stripeSessionAmountTotal: 12000,
        // Provide the stripe session currency field value.
        stripeSessionCurrency: 'eur',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result.confirmed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.bookingStatus).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(result.orderReference).toBe('#99');
    // Assert that the value matches the intended expectation.
    expect(result.title).toBe('Booking Confirmed');
  });

  // Define a single test case and its expectations.
  test('returns processing payload when finalize does not confirm yet', async () => {
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the metadata field value.
      metadata: { reservationId: '42' },
    });
    // Call orderSql.findOrderByStripeSessionId.mockResolvedValue to perform this step.
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    // Call finalizeReservationByStripeSessionId.mockResolvedValue to perform this step.
    finalizeReservationByStripeSessionId.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'overlap_after_payment',
      // Provide the reservation field value.
      reservation: { id: 42, status: 'manual_review' },
    });

    // Create the result constant.
    const result = await handleCheckoutSuccessFlow({
      // Provide the query field value.
      query: { session_id: 'cs_test_pending' },
      // Provide the request id field value.
      requestId: 'req-pending',
    });

    // Assert that the value matches the intended expectation.
    expect(result.confirmed).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.bookingStatus).toBe('manual_review');
    // Assert that the value matches the intended expectation.
    expect(result.title).toBe('Payment Received');
    // Assert that the value matches the intended expectation.
    expect(result.reservationId).toBe(42);
  });
});
