// Update process.env.STRIPE_SECRET with the right-hand side value.
process.env.STRIPE_SECRET = process.env.STRIPE_SECRET || 'sk_test_xxx';
// Update process.env.STRIPE_WEBHOOK_SECRET with the right-hand side value.
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

// Call jest.mock to perform this step.
jest.mock('../src/config/stripe', () => ({
  // Provide the webhooks field value.
  webhooks: {
    // Provide the construct event field value.
    constructEvent: jest.fn(),
  },
  // Provide the checkout field value.
  checkout: {
    // Provide the sessions field value.
    sessions: {
      // Provide the retrieve field value.
      retrieve: jest.fn(),
    },
  },
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/paymentEventSqlService', () => {
  // Create the store constant.
  const store = new Map();
  // Initialize the mutable seq variable.
  let seq = 1;
  // Return the resulting value to the caller.
  return {
    // Call _reset to perform this step.
    _reset() {
      // Call store.clear to perform this step.
      store.clear();
      // Update seq with the right-hand side value.
      seq = 1;
    },
    // Call _get to perform this step.
    _get(eventId) {
      // Return the resulting value to the caller.
      return store.get(eventId);
    },
    // Call _seed to perform this step.
    _seed(row) {
      // Call store.set to perform this step.
      store.set(row.event_id, { ...row });
      // Evaluate the condition and enter the branch when it is true.
      if (row.id >= seq) {
        // Update seq with the right-hand side value.
        seq = row.id + 1;
      }
    },
    // Provide the insert payment event field value.
    insertPaymentEvent: jest.fn(
      // Call async to perform this step.
      async ({
        // Contribute this line to the enclosing declaration or statement.
        eventId,
        // Contribute this line to the enclosing declaration or statement.
        eventType,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Update status with the right-hand side value.
        status = 'received',
        // Update payload with the right-hand side value.
        payload = null,
      // Continue the surrounding logic with this statement.
      }) => {
        // Evaluate the condition and enter the branch when it is true.
        if (eventId && store.has(eventId)) {
          // Create the err constant.
          const err = new Error('duplicate key value violates unique constraint');
          // Update err.code with the right-hand side value.
          err.code = '23505';
          // Throw an error to stop the current control flow.
          throw err;
        }
        // Create the row constant.
        const row = {
          // Provide the id field value.
          id: seq,
          // Provide the event id field value.
          event_id: eventId,
          // Provide the event type field value.
          event_type: eventType,
          // Provide the stripe session id field value.
          stripe_session_id: stripeSessionId || null,
          // Provide the reservation id field value.
          reservation_id: reservationId || null,
          // Contribute this line to the enclosing declaration or statement.
          status,
          // Contribute this line to the enclosing declaration or statement.
          payload,
        };
        // Update seq with the right-hand side value.
        seq += 1;
        // Evaluate the condition and enter the branch when it is true.
        if (eventId) {
          // Call store.set to perform this step.
          store.set(eventId, row);
        }
        // Return the resulting value to the caller.
        return { ...row };
      }
    ),
    // Provide the find by event id field value.
    findByEventId: jest.fn(async (eventId) => {
      // Create the row constant.
      const row = store.get(eventId);
      // Return the resulting value to the caller.
      return row ? { ...row } : null;
    }),
    // Provide the update payment event status field value.
    updatePaymentEventStatus: jest.fn(async (id, status) => {
      // Iterate using the loop initializer, condition, and step.
      for (const row of store.values()) {
        // Evaluate the condition and enter the branch when it is true.
        if (row.id === id) {
          // Update row.status with the right-hand side value.
          row.status = status;
          // Return the resulting value to the caller.
          return { ...row };
        }
      }
      // Return the resulting value to the caller.
      return null;
    }),
    // Provide the list stuck received refund events field value.
    listStuckReceivedRefundEvents: jest.fn().mockResolvedValue([]),
    // Provide the list recent payment events field value.
    listRecentPaymentEvents: jest.fn().mockResolvedValue([]),
  };
});

// Call jest.mock to perform this step.
jest.mock('../src/monitoring/track', () => ({
  // Provide the track webhook failure field value.
  trackWebhookFailure: jest.fn(),
  // Provide the track payment failure field value.
  trackPaymentFailure: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/bookingFinalizationService', () => ({
  // Provide the process stripe webhook event field value.
  processStripeWebhookEvent: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/refund/refundWebhookService', () => ({
  // Provide the apply refund from stripe object field value.
  applyRefundFromStripeObject: jest.fn().mockResolvedValue({ handled: true, status: 'succeeded' }),
}));

// Require the '../src/config/stripe' module as stripe.
const stripe = require('../src/config/stripe');
// Destructure object properties into local variables.
const { handleStripeWebhookFlow } = require('../src/services/payment/webhookService');
// Destructure object properties into local variables.
const { processStripeWebhookEvent } = require('../src/services/bookingFinalizationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
// Continue the surrounding logic with this statement.
} = require('../src/services/payment/refund/refundWebhookService');
// Require the '../src/services/sql/paymentEventSqlService' module as paymentEventSql.
const paymentEventSql = require('../src/services/sql/paymentEventSqlService');

// Define the buildSignedWebhookRequest function.
function buildSignedWebhookRequest(overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the method field value.
    method: 'POST',
    // Provide the original url field value.
    originalUrl: '/webhook/stripe',
    // Provide the correlation id field value.
    correlationId: 'test-correlation',
    // Provide the headers field value.
    headers: { 'stripe-signature': 'valid-signature' },
    // Provide the body field value.
    body: Buffer.from('{}'),
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Define the buildCheckoutCompletedEvent function.
function buildCheckoutCompletedEvent(sessionOverrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: 'evt_123',
    // Provide the type field value.
    type: 'checkout.session.completed',
    // Provide the data field value.
    data: {
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: 'cs_test_123',
        // Provide the metadata field value.
        metadata: {
          // Provide the reservation id field value.
          reservationId: '42',
          // Provide the car id field value.
          carId: '7',
          // Provide the session id field value.
          sessionId: 'sess_abc',
        },
        // Provide the client reference id field value.
        client_reference_id: '42',
        // Spread sessionOverrides into the surrounding structure.
        ...sessionOverrides,
      },
    },
  };
}

// Define the buildRefundEvent function.
function buildRefundEvent({ id = 'evt_refund_1', type = 'refund.updated', object } = {}) {
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    id,
    // Contribute this line to the enclosing declaration or statement.
    type,
    // Provide the data field value.
    data: {
      // Provide the object field value.
      object: object || {
        // Provide the id field value.
        id: 're_123',
        // Provide the object field value.
        object: 'refund',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the payment intent field value.
        payment_intent: 'pi_123',
      },
    },
  };
}

// Declare a test suite grouping related cases.
describe('handleStripeWebhookFlow', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call paymentEventSql._reset to perform this step.
    paymentEventSql._reset();
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });
  });

  // Define a single test case and its expectations.
  test('returns 400 with received:false when Stripe signature is invalid', async () => {
    // Call stripe.webhooks.constructEvent.mockImplementation to perform this step.
    stripe.webhooks.constructEvent.mockImplementation(() => {
      // Throw an error to stop the current control flow.
      throw new Error('Invalid signature');
    });

    // Create the req constant.
    const req = buildSignedWebhookRequest({ headers: { 'stripe-signature': 'invalid' } });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(req);

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 400, body: { received: false } });
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 400 with received:false when Stripe signature header is missing', async () => {
    // Call stripe.webhooks.constructEvent.mockImplementation to perform this step.
    stripe.webhooks.constructEvent.mockImplementation(() => {
      // Throw an error to stop the current control flow.
      throw new Error('No signature header value was provided.');
    });

    // Create the req constant.
    const req = buildSignedWebhookRequest({ headers: {} });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(req);

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 400, body: { received: false } });
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Supply the literal value used by the enclosing expression.
      undefined,
      // Contribute this line to the enclosing declaration or statement.
      process.env.STRIPE_WEBHOOK_SECRET
    );
  });

  // Define a single test case and its expectations.
  test('processes valid checkout.session.completed events', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: true,
      // Provide the reason field value.
      reason: 'finalized',
      // Provide the reservation field value.
      reservation: { id: '42' },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the event id field value.
        eventId: 'evt_123',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_test_123',
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the car id field value.
        carId: '7',
        // Provide the session id field value.
        sessionId: 'sess_abc',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('skips duplicate checkout.session.completed events', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'duplicate_event',
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('returns 200 when reservation is missing', async () => {
    // Destructure object properties into local variables.
    const { trackWebhookFailure } = require('../src/monitoring/track');
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: false,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'not_found',
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(trackWebhookFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'reservation_not_found',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ stripeSessionId: 'cs_test_123' })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('returns 200 when reservation is already confirmed', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'already_confirmed',
      // Provide the reservation field value.
      reservation: { id: '42', status: 'confirmed' },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('returns 200 when paid webhook overlap requires manual review', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(
      // Call buildCheckoutCompletedEvent to perform this step.
      buildCheckoutCompletedEvent({
        // Provide the payment status field value.
        payment_status: 'paid',
        // Provide the payment intent field value.
        payment_intent: 'pi_overlap_789',
      })
    );
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'overlap_after_payment',
      // Provide the status field value.
      status: 'manual_review',
      // Provide the reservation field value.
      reservation: { id: '42' },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the stripe payment intent field value.
        stripePaymentIntent: 'pi_overlap_789',
        // Provide the stripe session payment status field value.
        stripeSessionPaymentStatus: 'paid',
      })
    );
  });

  // Define a single test case and its expectations.
  test('tracks inactive reservation status without throwing', async () => {
    // Destructure object properties into local variables.
    const { trackWebhookFailure } = require('../src/monitoring/track');
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    // Call processStripeWebhookEvent.mockResolvedValue to perform this step.
    processStripeWebhookEvent.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'status_not_active',
      // Provide the reservation field value.
      reservation: { id: '42', status: 'expired' },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(trackWebhookFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'reservation_not_active',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: '42', status: 'expired' })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('applies refund.updated webhook via refund service', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 're_123', status: 'succeeded' }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ eventType: 'refund.updated' })
    );
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('processed');
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').payload).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('routes refund.created webhook via refund service', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue({
      // Provide the id field value.
      id: 'evt_refund_created_1',
      // Provide the type field value.
      type: 'refund.created',
      // Provide the data field value.
      data: {
        // Provide the object field value.
        object: {
          // Provide the id field value.
          id: 're_created',
          // Provide the object field value.
          object: 'refund',
          // Provide the status field value.
          status: 'pending',
          // Provide the payment intent field value.
          payment_intent: 'pi_123',
        },
      },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 're_created', status: 'pending' }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ eventType: 'refund.created' })
    );
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('routes refund.failed webhook via refund service', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue({
      // Provide the id field value.
      id: 'evt_refund_failed_1',
      // Provide the type field value.
      type: 'refund.failed',
      // Provide the data field value.
      data: {
        // Provide the object field value.
        object: {
          // Provide the id field value.
          id: 're_failed',
          // Provide the object field value.
          object: 'refund',
          // Provide the status field value.
          status: 'failed',
          // Provide the payment intent field value.
          payment_intent: 'pi_123',
        },
      },
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 're_failed', status: 'failed' }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ eventType: 'refund.failed' })
    );
    // Assert that the value matches the intended expectation.
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  // Define a single test case and its expectations.
  test('inbox insert throw returns 500 and does not apply', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    // Call paymentEventSql.insertPaymentEvent.mockRejectedValueOnce to perform this step.
    paymentEventSql.insertPaymentEvent.mockRejectedValueOnce(new Error('inbox insert failed'));

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result.statusCode).toBe(500);
    // Assert that the value matches the intended expectation.
    expect(result.body).toEqual({ received: false });
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('apply throw returns 500 not 200', async () => {
    // Destructure object properties into local variables.
    const { trackWebhookFailure } = require('../src/monitoring/track');
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    // Call applyRefundFromStripeObject.mockRejectedValue to perform this step.
    applyRefundFromStripeObject.mockRejectedValue(new Error('db down'));

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result.statusCode).toBe(500);
    // Assert that the value matches the intended expectation.
    expect(result.body).toEqual({ received: false });
    // Assert that the value matches the intended expectation.
    expect(trackWebhookFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'refund_apply_failed',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ eventId: 'evt_refund_1' })
    );
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('received');
  });

  // Define a single test case and its expectations.
  test('no_matching_operation returns 200 and ignored', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({
      // Provide the handled field value.
      handled: false,
      // Provide the reason field value.
      reason: 'no_matching_operation',
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('ignored');
  });

  // Define a single test case and its expectations.
  test('partial_or_amount_mismatch returns 200 and ignored', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({
      // Provide the handled field value.
      handled: false,
      // Provide the reason field value.
      reason: 'partial_or_amount_mismatch',
    });

    // Create the result constant.
    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('ignored');
  });

  // Define a single test case and its expectations.
  test('duplicate terminal event returns 200 without applying again', async () => {
    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());

    // Create the first constant.
    const first = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    // Assert that the value matches the intended expectation.
    expect(first.statusCode).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(1);

    // Call applyRefundFromStripeObject.mockClear to perform this step.
    applyRefundFromStripeObject.mockClear();
    // Create the second constant.
    const second = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    // Assert that the value matches the intended expectation.
    expect(second).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('stuck received is retried, not ACK-as-done', async () => {
    // Call paymentEventSql._seed to perform this step.
    paymentEventSql._seed({
      // Provide the id field value.
      id: 99,
      // Provide the event id field value.
      event_id: 'evt_refund_1',
      // Provide the event type field value.
      event_type: 'refund.updated',
      // Provide the status field value.
      status: 'received',
      // Provide the payload field value.
      payload: { id: 'evt_refund_1', type: 'refund.updated' },
    });

    // Call stripe.webhooks.constructEvent.mockReturnValue to perform this step.
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    // Call applyRefundFromStripeObject.mockRejectedValueOnce to perform this step.
    applyRefundFromStripeObject.mockRejectedValueOnce(new Error('still failing'));

    // Create the failing constant.
    const failing = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    // Assert that the value matches the intended expectation.
    expect(failing.statusCode).toBe(500);
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('received');

    // Call applyRefundFromStripeObject.mockResolvedValueOnce to perform this step.
    applyRefundFromStripeObject.mockResolvedValueOnce({ handled: true, status: 'succeeded' });
    // Create the recovered constant.
    const recovered = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    // Assert that the value matches the intended expectation.
    expect(recovered).toEqual({ statusCode: 200, body: { received: true } });
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql._get('evt_refund_1').status).toBe('processed');
  });
});
