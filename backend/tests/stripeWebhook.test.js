process.env.STRIPE_SECRET = process.env.STRIPE_SECRET || 'sk_test_xxx';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

jest.mock('../src/config/stripe', () => ({
  webhooks: {
    constructEvent: jest.fn(),
  },
  checkout: {
    sessions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('../src/services/sql/paymentEventSqlService', () => {
  const store = new Map();
  let seq = 1;
  return {
    _reset() {
      store.clear();
      seq = 1;
    },
    _get(eventId) {
      return store.get(eventId);
    },
    _seed(row) {
      store.set(row.event_id, { ...row });
      if (row.id >= seq) {
        seq = row.id + 1;
      }
    },
    insertPaymentEvent: jest.fn(
      async ({
        eventId,
        eventType,
        stripeSessionId,
        reservationId,
        status = 'received',
        payload = null,
      }) => {
        if (eventId && store.has(eventId)) {
          const err = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        const row = {
          id: seq,
          event_id: eventId,
          event_type: eventType,
          stripe_session_id: stripeSessionId || null,
          reservation_id: reservationId || null,
          status,
          payload,
        };
        seq += 1;
        if (eventId) {
          store.set(eventId, row);
        }
        return { ...row };
      }
    ),
    findByEventId: jest.fn(async (eventId) => {
      const row = store.get(eventId);
      return row ? { ...row } : null;
    }),
    updatePaymentEventStatus: jest.fn(async (id, status) => {
      for (const row of store.values()) {
        if (row.id === id) {
          row.status = status;
          return { ...row };
        }
      }
      return null;
    }),
    listStuckReceivedRefundEvents: jest.fn().mockResolvedValue([]),
    listRecentPaymentEvents: jest.fn().mockResolvedValue([]),
  };
});

jest.mock('../src/monitoring/track', () => ({
  trackWebhookFailure: jest.fn(),
  trackPaymentFailure: jest.fn(),
}));

jest.mock('../src/services/bookingFinalizationService', () => ({
  processStripeWebhookEvent: jest.fn(),
}));

jest.mock('../src/services/payment/refund/refundWebhookService', () => ({
  applyRefundFromStripeObject: jest.fn().mockResolvedValue({ handled: true, status: 'succeeded' }),
}));

const stripe = require('../src/config/stripe');
const { handleStripeWebhookFlow } = require('../src/services/payment/webhookService');
const { processStripeWebhookEvent } = require('../src/services/bookingFinalizationService');
const {
  applyRefundFromStripeObject,
} = require('../src/services/payment/refund/refundWebhookService');
const paymentEventSql = require('../src/services/sql/paymentEventSqlService');

function buildSignedWebhookRequest(overrides = {}) {
  return {
    method: 'POST',
    originalUrl: '/webhook/stripe',
    correlationId: 'test-correlation',
    headers: { 'stripe-signature': 'valid-signature' },
    body: Buffer.from('{}'),
    ...overrides,
  };
}

function buildCheckoutCompletedEvent(sessionOverrides = {}) {
  return {
    id: 'evt_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        metadata: {
          reservationId: '42',
          carId: '7',
          sessionId: 'sess_abc',
        },
        client_reference_id: '42',
        ...sessionOverrides,
      },
    },
  };
}

function buildRefundEvent({ id = 'evt_refund_1', type = 'refund.updated', object } = {}) {
  return {
    id,
    type,
    data: {
      object: object || {
        id: 're_123',
        object: 'refund',
        status: 'succeeded',
        payment_intent: 'pi_123',
      },
    },
  };
}

describe('handleStripeWebhookFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentEventSql._reset();
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });
  });

  test('returns 400 with received:false when Stripe signature is invalid', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = buildSignedWebhookRequest({ headers: { 'stripe-signature': 'invalid' } });

    const result = await handleStripeWebhookFlow(req);

    expect(result).toEqual({ statusCode: 400, body: { received: false } });
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });

  test('returns 400 with received:false when Stripe signature header is missing', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signature header value was provided.');
    });

    const req = buildSignedWebhookRequest({ headers: {} });

    const result = await handleStripeWebhookFlow(req);

    expect(result).toEqual({ statusCode: 400, body: { received: false } });
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  });

  test('processes valid checkout.session.completed events', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    processStripeWebhookEvent.mockResolvedValue({
      found: true,
      finalized: true,
      reason: 'finalized',
      reservation: { id: '42' },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_123',
        stripeSessionId: 'cs_test_123',
        reservationId: '42',
        carId: '7',
        sessionId: 'sess_abc',
      })
    );
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('skips duplicate checkout.session.completed events', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    processStripeWebhookEvent.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'duplicate_event',
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('returns 200 when reservation is missing', async () => {
    const { trackWebhookFailure } = require('../src/monitoring/track');
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    processStripeWebhookEvent.mockResolvedValue({
      found: false,
      finalized: false,
      reason: 'not_found',
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(trackWebhookFailure).toHaveBeenCalledWith(
      'reservation_not_found',
      expect.objectContaining({ stripeSessionId: 'cs_test_123' })
    );
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('returns 200 when reservation is already confirmed', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    processStripeWebhookEvent.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'already_confirmed',
      reservation: { id: '42', status: 'confirmed' },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('returns 200 when paid webhook overlap requires manual review', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(
      buildCheckoutCompletedEvent({
        payment_status: 'paid',
        payment_intent: 'pi_overlap_789',
      })
    );
    processStripeWebhookEvent.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'overlap_after_payment',
      status: 'manual_review',
      reservation: { id: '42' },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    expect(processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripePaymentIntent: 'pi_overlap_789',
        stripeSessionPaymentStatus: 'paid',
      })
    );
  });

  test('tracks inactive reservation status without throwing', async () => {
    const { trackWebhookFailure } = require('../src/monitoring/track');
    stripe.webhooks.constructEvent.mockReturnValue(buildCheckoutCompletedEvent());
    processStripeWebhookEvent.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'status_not_active',
      reservation: { id: '42', status: 'expired' },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(trackWebhookFailure).toHaveBeenCalledWith(
      'reservation_not_active',
      expect.objectContaining({ reservationId: '42', status: 'expired' })
    );
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('applies refund.updated webhook via refund service', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 're_123', status: 'succeeded' }),
      expect.objectContaining({ eventType: 'refund.updated' })
    );
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    expect(paymentEventSql._get('evt_refund_1').status).toBe('processed');
    expect(paymentEventSql._get('evt_refund_1').payload).toBeTruthy();
  });

  test('routes refund.created webhook via refund service', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_refund_created_1',
      type: 'refund.created',
      data: {
        object: {
          id: 're_created',
          object: 'refund',
          status: 'pending',
          payment_intent: 'pi_123',
        },
      },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 're_created', status: 'pending' }),
      expect.objectContaining({ eventType: 'refund.created' })
    );
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('routes refund.failed webhook via refund service', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_refund_failed_1',
      type: 'refund.failed',
      data: {
        object: {
          id: 're_failed',
          object: 'refund',
          status: 'failed',
          payment_intent: 'pi_123',
        },
      },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 're_failed', status: 'failed' }),
      expect.objectContaining({ eventType: 'refund.failed' })
    );
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });

  test('inbox insert throw returns 500 and does not apply', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    paymentEventSql.insertPaymentEvent.mockRejectedValueOnce(new Error('inbox insert failed'));

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ received: false });
    expect(applyRefundFromStripeObject).not.toHaveBeenCalled();
  });

  test('apply throw returns 500 not 200', async () => {
    const { trackWebhookFailure } = require('../src/monitoring/track');
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    applyRefundFromStripeObject.mockRejectedValue(new Error('db down'));

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ received: false });
    expect(trackWebhookFailure).toHaveBeenCalledWith(
      'refund_apply_failed',
      expect.objectContaining({ eventId: 'evt_refund_1' })
    );
    expect(paymentEventSql._get('evt_refund_1').status).toBe('received');
  });

  test('no_matching_operation returns 200 and ignored', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    applyRefundFromStripeObject.mockResolvedValue({
      handled: false,
      reason: 'no_matching_operation',
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    expect(paymentEventSql._get('evt_refund_1').status).toBe('ignored');
  });

  test('partial_or_amount_mismatch returns 200 and ignored', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    applyRefundFromStripeObject.mockResolvedValue({
      handled: false,
      reason: 'partial_or_amount_mismatch',
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(result).toEqual({ statusCode: 200, body: { received: true } });
    expect(paymentEventSql._get('evt_refund_1').status).toBe('ignored');
  });

  test('duplicate terminal event returns 200 without applying again', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());

    const first = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    expect(first.statusCode).toBe(200);
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(1);

    applyRefundFromStripeObject.mockClear();
    const second = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(second).toEqual({ statusCode: 200, body: { received: true } });
    expect(applyRefundFromStripeObject).not.toHaveBeenCalled();
  });

  test('stuck received is retried, not ACK-as-done', async () => {
    paymentEventSql._seed({
      id: 99,
      event_id: 'evt_refund_1',
      event_type: 'refund.updated',
      status: 'received',
      payload: { id: 'evt_refund_1', type: 'refund.updated' },
    });

    stripe.webhooks.constructEvent.mockReturnValue(buildRefundEvent());
    applyRefundFromStripeObject.mockRejectedValueOnce(new Error('still failing'));

    const failing = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    expect(failing.statusCode).toBe(500);
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(1);
    expect(paymentEventSql._get('evt_refund_1').status).toBe('received');

    applyRefundFromStripeObject.mockResolvedValueOnce({ handled: true, status: 'succeeded' });
    const recovered = await handleStripeWebhookFlow(buildSignedWebhookRequest());
    expect(recovered).toEqual({ statusCode: 200, body: { received: true } });
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(2);
    expect(paymentEventSql._get('evt_refund_1').status).toBe('processed');
  });
});
