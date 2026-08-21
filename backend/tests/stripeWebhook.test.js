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

jest.mock('../src/services/sql/paymentEventSqlService', () => ({
  insertPaymentEvent: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/monitoring/track', () => ({
  trackWebhookFailure: jest.fn(),
  trackPaymentFailure: jest.fn(),
}));

jest.mock('../src/services/bookingFinalizationService', () => ({
  processStripeWebhookEvent: jest.fn(),
}));

jest.mock('../src/services/payment/refund/reservationRefundService', () => ({
  applyRefundFromStripeObject: jest.fn().mockResolvedValue({ handled: true, status: 'succeeded' }),
}));

const stripe = require('../src/config/stripe');
const { handleStripeWebhookFlow } = require('../src/services/payment/webhookService');
const { processStripeWebhookEvent } = require('../src/services/bookingFinalizationService');
const {
  applyRefundFromStripeObject,
} = require('../src/services/payment/refund/reservationRefundService');

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

describe('handleStripeWebhookFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_refund_1',
      type: 'refund.updated',
      data: {
        object: {
          id: 're_123',
          object: 'refund',
          status: 'succeeded',
          payment_intent: 'pi_123',
        },
      },
    });

    const result = await handleStripeWebhookFlow(buildSignedWebhookRequest());

    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 're_123', status: 'succeeded' }),
      expect.objectContaining({ eventType: 'refund.updated' })
    );
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, body: { received: true } });
  });
});
