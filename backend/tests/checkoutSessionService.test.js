jest.mock('../src/repositories/carRepository', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/repositories/reservationRepository', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/services/sql/reservationSqlService', () => ({
  reserveCheckoutAttempt: jest.fn(),
}));

jest.mock('../src/db/transaction', () => ({
  withReservationCheckoutLock: jest.fn(async (_id, work) => work({})),
  isCheckoutLockBusyError: (err) => Boolean(err && err.code === 'CHECKOUT_LOCK_BUSY'),
}));

jest.mock('../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
}));

jest.mock('../src/services/payment/stripeCheckoutService', () => ({
  buildCheckoutIdempotencyKey: jest.fn(
    (reservationId, attempt) => `checkout:reservation:${reservationId}:attempt${attempt}`
  ),
  createStripeCheckoutSession: jest.fn(),
  expireStripeCheckoutSession: jest.fn(),
  retrieveStripeCheckoutSession: jest.fn(),
  safeExpireSupersededCheckoutSession: jest.fn(),
}));

jest.mock('../src/services/payment/checkout/checkoutValidationService', () => ({
  validateCheckoutRequest: jest.fn(),
}));

jest.mock('../src/services/payment/checkout/checkoutPricingService', () => ({
  resolveCheckoutPricing: jest.fn(),
}));

jest.mock('../src/services/payment/checkout/checkoutReservationService', () => ({
  resolveCheckoutReservation: jest.fn(),
}));

jest.mock('../src/services/payment/checkout/checkoutCompensationService', () => ({
  compensateReservationAfterStripeFailure: jest.fn(),
}));

jest.mock('../src/monitoring/logEvent', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../src/monitoring/track', () => ({
  trackPaymentFailure: jest.fn(),
}));

jest.mock('../src/monitoring/metrics', () => ({
  incrementCheckoutStarted: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../src/services/admin/adminAuditService', () => ({
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));

const carRepository = require('../src/repositories/carRepository');
const reservationRepository = require('../src/repositories/reservationRepository');
const reservationSql = require('../src/services/sql/reservationSqlService');
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
const {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  safeExpireSupersededCheckoutSession,
} = require('../src/services/payment/stripeCheckoutService');
const { withReservationCheckoutLock } = require('../src/db/transaction');
const { validateCheckoutRequest } = require('../src/services/payment/checkout/checkoutValidationService');
const { resolveCheckoutPricing } = require('../src/services/payment/checkout/checkoutPricingService');
const { resolveCheckoutReservation } = require('../src/services/payment/checkout/checkoutReservationService');
const { trackPaymentFailure } = require('../src/monitoring/track');
const logger = require('../src/utils/logger');
const { createCheckoutSessionFlow } = require('../src/services/payment/checkout/checkoutSessionService');

describe('createCheckoutSessionFlow', () => {
  const car = { id: '7', name: 'BMW X5' };
  const formData = {
    carId: '7',
    pickupDate: '2026-07-01',
    returnDate: '2026-07-05',
    fullName: 'Guest User',
    email: 'guest@example.com',
  };
  const pricing = {
    rentalDays: 4,
    deliveryPrice: 0,
    returnPrice: 0,
    totalPrice: 120,
  };
  const reservationDoc = {
    id: '42',
    status: 'pending_payment',
    carId: '7',
  };
  const stripeSession = {
    id: 'cs_test_orphan_123',
    url: 'https://stripe.test/checkout/cs_test_orphan_123',
  };

  const req = {
    body: formData,
    originalUrl: '/checkout',
    requestId: 'corr-db-fail',
    correlationId: 'corr-db-fail',
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
    session: { id: 'sess_abc' },
  };

  function mockResolvedReservation(doc, createdReservationThisStep = true) {
    resolveCheckoutReservation.mockResolvedValue({
      ok: true,
      reservationDoc: { ...doc },
      createdReservationThisStep,
    });
    reservationRepository.findById.mockResolvedValue({ ...doc });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    changeStatus.mockReset();

    carRepository.findById.mockResolvedValue(car);
    validateCheckoutRequest.mockReturnValue({
      ok: true,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-05'),
    });
    resolveCheckoutPricing.mockReturnValue({ ok: true, pricing });
    mockResolvedReservation(reservationDoc, true);
    reservationSql.reserveCheckoutAttempt.mockResolvedValue(1);
    createStripeCheckoutSession.mockResolvedValue(stripeSession);
    expireStripeCheckoutSession.mockReset();
    expireStripeCheckoutSession.mockResolvedValue({ id: stripeSession.id, status: 'expired' });
    retrieveStripeCheckoutSession.mockReset();
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: true, skipped: true });
    changeStatus.mockResolvedValue({
      reservation: {
        ...reservationDoc,
        stripeSessionId: stripeSession.id,
        status: 'processing_payment',
      },
      changed: true,
      oldStatus: 'pending_payment',
      newStatus: 'processing_payment',
    });
  });

  test('expires orphan Stripe session and returns clean error when reservation update fails', async () => {
    const dbError = new Error('connection reset');
    changeStatus.mockRejectedValue(dbError);

    const result = await createCheckoutSessionFlow(req);

    expect(expireStripeCheckoutSession).toHaveBeenCalledWith(stripeSession.id);
    expect(reservationSql.reserveCheckoutAttempt).toHaveBeenCalledWith('42', {
      forceIncrement: true,
    });
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'reservation_stripe_session_link_failed',
      expect.objectContaining({
        requestId: 'corr-db-fail',
        reservationId: '42',
        stripeSessionId: stripeSession.id,
        stripeExpireAttempted: true,
        stripeExpireFailed: false,
        message: dbError.message,
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Unable to start payment. Please try again in a minute.',
        car,
      })
    );
    expect(changeStatus).toHaveBeenCalledTimes(1);
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: '42',
        newStatus: 'processing_payment',
        patch: { stripeSessionId: stripeSession.id },
      })
    );
  });

  test('still returns clean error and logs expire failure when Stripe session expire fails', async () => {
    const dbError = new Error('deadlock detected');
    const expireError = new Error('Stripe API unavailable');
    changeStatus.mockRejectedValue(dbError);
    expireStripeCheckoutSession.mockRejectedValue(expireError);

    const result = await createCheckoutSessionFlow(req);

    expect(expireStripeCheckoutSession).toHaveBeenCalledWith(stripeSession.id);
    expect(reservationSql.reserveCheckoutAttempt).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expireError,
        originalErr: dbError,
        stripeSessionId: stripeSession.id,
        reservationId: '42',
        correlationId: 'corr-db-fail',
      }),
      'Failed to expire orphan Stripe checkout session after reservation update failure'
    );
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'reservation_stripe_session_link_failed',
      expect.objectContaining({
        stripeExpireAttempted: true,
        stripeExpireFailed: true,
        message: dbError.message,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  test('redirects to Stripe when reservation update succeeds', async () => {
    const result = await createCheckoutSessionFlow(req);

    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    expect(expireStripeCheckoutSession).not.toHaveBeenCalled();
    expect(trackPaymentFailure).not.toHaveBeenCalled();
    expect(createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'checkout:reservation:42:attempt1',
      })
    );
    expect(result).toEqual({
      type: 'redirect',
      statusCode: 303,
      url: stripeSession.url,
    });
  });

  test('reuses an open Stripe session when the amount still matches', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_previous_active',
        status: 'processing_payment',
      },
      false
    );
    retrieveStripeCheckoutSession.mockResolvedValue({
      id: 'cs_previous_active',
      url: 'https://stripe.test/checkout/cs_previous_active',
      status: 'open',
      payment_status: 'unpaid',
      amount_total: 12000,
    });

    const result = await createCheckoutSessionFlow(req);

    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: 'redirect',
      statusCode: 303,
      url: 'https://stripe.test/checkout/cs_previous_active',
    });
  });

  test('expires previous stripe session before creating when the amount changed', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_previous_active',
        status: 'processing_payment',
      },
      false
    );
    retrieveStripeCheckoutSession
      .mockResolvedValueOnce({
        id: 'cs_previous_active',
        url: 'https://stripe.test/checkout/cs_previous_active',
        status: 'open',
        payment_status: 'unpaid',
        amount_total: 9999,
      })
      .mockResolvedValueOnce({
        id: 'cs_previous_active',
        status: 'expired',
        payment_status: 'unpaid',
      });
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: true, expired: true });

    await createCheckoutSessionFlow(req);

    expect(safeExpireSupersededCheckoutSession).toHaveBeenCalledWith(
      'cs_previous_active',
      expect.objectContaining({ reservationId: '42' })
    );
    expect(createStripeCheckoutSession).toHaveBeenCalled();
  });

  test('refuses to create when previous session expire is inconclusive', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_previous_active',
        status: 'processing_payment',
      },
      false
    );
    retrieveStripeCheckoutSession.mockResolvedValue({
      id: 'cs_previous_active',
      url: 'https://stripe.test/checkout/cs_previous_active',
      status: 'open',
      payment_status: 'unpaid',
      amount_total: 9999,
    });
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: false, error: new Error('stripe down') });

    const result = await createCheckoutSessionFlow(req);

    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  test('continues checkout when previous stripe session is already expired', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_previous_expired',
        status: 'pending_payment',
      },
      false
    );
    retrieveStripeCheckoutSession.mockResolvedValue({
      id: 'cs_previous_expired',
      status: 'expired',
      payment_status: 'unpaid',
    });

    const result = await createCheckoutSessionFlow(req);

    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    expect(result.type).toBe('redirect');
    expect(createStripeCheckoutSession).toHaveBeenCalled();
  });

  test('blocks new checkout when previous stripe session is already paid', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_previous_paid',
        status: 'processing_payment',
      },
      false
    );
    retrieveStripeCheckoutSession.mockResolvedValue({
      id: 'cs_previous_paid',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 12000,
    });

    const result = await createCheckoutSessionFlow(req);

    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'superseded_stripe_session_already_paid',
      expect.objectContaining({
        stripeSessionId: 'cs_previous_paid',
        reservationId: '42',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Your payment is being reviewed. Please contact support if you need help.',
      })
    );
  });

  test('refuses to create when the existing Stripe session cannot be retrieved', async () => {
    mockResolvedReservation(
      {
        ...reservationDoc,
        stripeSessionId: 'cs_missing',
        status: 'processing_payment',
      },
      false
    );
    retrieveStripeCheckoutSession.mockRejectedValue(new Error('No such checkout.session'));

    const result = await createCheckoutSessionFlow(req);

    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  test('returns clean error when checkout lock stays busy', async () => {
    const err = new Error('Checkout lock busy');
    err.code = 'CHECKOUT_LOCK_BUSY';
    withReservationCheckoutLock.mockRejectedValueOnce(err);

    const result = await createCheckoutSessionFlow(req);

    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    expect(reservationRepository.findById).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'renderOrderPage',
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });
});
