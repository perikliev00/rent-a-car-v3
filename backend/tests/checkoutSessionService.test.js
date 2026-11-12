// Call jest.mock to perform this step.
jest.mock('../src/repositories/carRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/repositories/reservationRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/reservationSqlService', () => ({
  // Provide the reserve checkout attempt field value.
  reserveCheckoutAttempt: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/db/transaction', () => ({
  // Provide the with reservation checkout lock field value.
  withReservationCheckoutLock: jest.fn(async (_id, work) => work({})),
  // Provide the is checkout lock busy error field value.
  isCheckoutLockBusyError: (err) => Boolean(err && err.code === 'CHECKOUT_LOCK_BUSY'),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/stripeCheckoutService', () => ({
  // Provide the build checkout idempotency key field value.
  buildCheckoutIdempotencyKey: jest.fn(
    // Continue the surrounding logic with this statement.
    (reservationId, attempt) => `checkout:reservation:${reservationId}:attempt${attempt}`
  ),
  // Provide the create stripe checkout session field value.
  createStripeCheckoutSession: jest.fn(),
  // Provide the expire stripe checkout session field value.
  expireStripeCheckoutSession: jest.fn(),
  // Provide the retrieve stripe checkout session field value.
  retrieveStripeCheckoutSession: jest.fn(),
  // Provide the safe expire superseded checkout session field value.
  safeExpireSupersededCheckoutSession: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/checkout/checkoutValidationService', () => ({
  // Provide the validate checkout request field value.
  validateCheckoutRequest: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/checkout/checkoutPricingService', () => ({
  // Provide the resolve checkout pricing field value.
  resolveCheckoutPricing: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/checkout/checkoutReservationService', () => ({
  // Provide the resolve checkout reservation field value.
  resolveCheckoutReservation: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/payment/checkout/checkoutCompensationService', () => ({
  // Provide the compensate reservation after stripe failure field value.
  compensateReservationAfterStripeFailure: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/monitoring/logEvent', () => ({
  // Provide the info field value.
  info: jest.fn(),
  // Provide the warn field value.
  warn: jest.fn(),
  // Provide the error field value.
  error: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/monitoring/track', () => ({
  // Provide the track payment failure field value.
  trackPaymentFailure: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/monitoring/metrics', () => ({
  // Provide the increment checkout started field value.
  incrementCheckoutStarted: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/utils/logger', () => ({
  // Provide the error field value.
  error: jest.fn(),
  // Provide the warn field value.
  warn: jest.fn(),
  // Provide the info field value.
  info: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/admin/adminAuditService', () => ({
  // Provide the log customer action field value.
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));

// Require the '../src/repositories/carRepository' module as carRepository.
const carRepository = require('../src/repositories/carRepository');
// Require the '../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../src/repositories/reservationRepository');
// Require the '../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../src/services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  expireStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  safeExpireSupersededCheckoutSession,
// Continue the surrounding logic with this statement.
} = require('../src/services/payment/stripeCheckoutService');
// Destructure object properties into local variables.
const { withReservationCheckoutLock } = require('../src/db/transaction');
// Destructure object properties into local variables.
const { validateCheckoutRequest } = require('../src/services/payment/checkout/checkoutValidationService');
// Destructure object properties into local variables.
const { resolveCheckoutPricing } = require('../src/services/payment/checkout/checkoutPricingService');
// Destructure object properties into local variables.
const { resolveCheckoutReservation } = require('../src/services/payment/checkout/checkoutReservationService');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../src/monitoring/track');
// Require the '../src/utils/logger' module as logger.
const logger = require('../src/utils/logger');
// Destructure object properties into local variables.
const { createCheckoutSessionFlow } = require('../src/services/payment/checkout/checkoutSessionService');

// Declare a test suite grouping related cases.
describe('createCheckoutSessionFlow', () => {
  // Create the car constant.
  const car = { id: '7', name: 'BMW X5' };
  // Create the form data constant.
  const formData = {
    // Provide the car id field value.
    carId: '7',
    // Provide the pickup date field value.
    pickupDate: '2026-07-01',
    // Provide the return date field value.
    returnDate: '2026-07-05',
    // Provide the full name field value.
    fullName: 'Guest User',
    // Provide the email field value.
    email: 'guest@example.com',
  };
  // Create the pricing constant.
  const pricing = {
    // Provide the rental days field value.
    rentalDays: 4,
    // Provide the delivery price field value.
    deliveryPrice: 0,
    // Provide the return price field value.
    returnPrice: 0,
    // Provide the total price field value.
    totalPrice: 120,
  };
  // Create the reservation doc constant.
  const reservationDoc = {
    // Provide the id field value.
    id: '42',
    // Provide the status field value.
    status: 'pending_payment',
    // Provide the car id field value.
    carId: '7',
  };
  // Create the stripe session constant.
  const stripeSession = {
    // Provide the id field value.
    id: 'cs_test_orphan_123',
    // Provide the url field value.
    url: 'https://stripe.test/checkout/cs_test_orphan_123',
  };

  // Create the req constant.
  const req = {
    // Provide the body field value.
    body: formData,
    // Provide the original url field value.
    originalUrl: '/checkout',
    // Provide the request id field value.
    requestId: 'corr-db-fail',
    // Provide the correlation id field value.
    correlationId: 'corr-db-fail',
    // Provide the protocol field value.
    protocol: 'http',
    // Provide the get field value.
    get: jest.fn().mockReturnValue('localhost:3000'),
    // Provide the session field value.
    session: { id: 'sess_abc' },
  };

  // Define the mockResolvedReservation function.
  function mockResolvedReservation(doc, createdReservationThisStep = true) {
    // Call resolveCheckoutReservation.mockResolvedValue to perform this step.
    resolveCheckoutReservation.mockResolvedValue({
      // Provide the ok field value.
      ok: true,
      // Provide the reservation doc field value.
      reservationDoc: { ...doc },
      // Contribute this line to the enclosing declaration or statement.
      createdReservationThisStep,
    });
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({ ...doc });
  }

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call changeStatus.mockReset to perform this step.
    changeStatus.mockReset();

    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(car);
    // Call validateCheckoutRequest.mockReturnValue to perform this step.
    validateCheckoutRequest.mockReturnValue({
      // Provide the ok field value.
      ok: true,
      // Provide the start date field value.
      startDate: new Date('2026-07-01'),
      // Provide the end date field value.
      endDate: new Date('2026-07-05'),
    });
    // Call resolveCheckoutPricing.mockReturnValue to perform this step.
    resolveCheckoutPricing.mockReturnValue({ ok: true, pricing });
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(reservationDoc, true);
    // Call reservationSql.reserveCheckoutAttempt.mockResolvedValue to perform this step.
    reservationSql.reserveCheckoutAttempt.mockResolvedValue(1);
    // Call createStripeCheckoutSession.mockResolvedValue to perform this step.
    createStripeCheckoutSession.mockResolvedValue(stripeSession);
    // Call expireStripeCheckoutSession.mockReset to perform this step.
    expireStripeCheckoutSession.mockReset();
    // Call expireStripeCheckoutSession.mockResolvedValue to perform this step.
    expireStripeCheckoutSession.mockResolvedValue({ id: stripeSession.id, status: 'expired' });
    // Call retrieveStripeCheckoutSession.mockReset to perform this step.
    retrieveStripeCheckoutSession.mockReset();
    // Call safeExpireSupersededCheckoutSession.mockResolvedValue to perform this step.
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: true, skipped: true });
    // Call changeStatus.mockResolvedValue to perform this step.
    changeStatus.mockResolvedValue({
      // Provide the reservation field value.
      reservation: {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: stripeSession.id,
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Provide the changed field value.
      changed: true,
      // Provide the old status field value.
      oldStatus: 'pending_payment',
      // Provide the new status field value.
      newStatus: 'processing_payment',
    });
  });

  // Define a single test case and its expectations.
  test('expires orphan Stripe session and returns clean error when reservation update fails', async () => {
    // Create the db error constant.
    const dbError = new Error('connection reset');
    // Call changeStatus.mockRejectedValue to perform this step.
    changeStatus.mockRejectedValue(dbError);

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(expireStripeCheckoutSession).toHaveBeenCalledWith(stripeSession.id);
    // Assert that the value matches the intended expectation.
    expect(reservationSql.reserveCheckoutAttempt).toHaveBeenCalledWith('42', {
      // Provide the force increment field value.
      forceIncrement: true,
    });
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'reservation_stripe_session_link_failed',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the request id field value.
        requestId: 'corr-db-fail',
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session id field value.
        stripeSessionId: stripeSession.id,
        // Provide the stripe expire attempted field value.
        stripeExpireAttempted: true,
        // Provide the stripe expire failed field value.
        stripeExpireFailed: false,
        // Provide the message field value.
        message: dbError.message,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(logger.error).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Unable to start payment. Please try again in a minute.',
        // Contribute this line to the enclosing declaration or statement.
        car,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the new status field value.
        newStatus: 'processing_payment',
        // Provide the patch field value.
        patch: { stripeSessionId: stripeSession.id },
      })
    );
  });

  // Define a single test case and its expectations.
  test('still returns clean error and logs expire failure when Stripe session expire fails', async () => {
    // Create the db error constant.
    const dbError = new Error('deadlock detected');
    // Create the expire error constant.
    const expireError = new Error('Stripe API unavailable');
    // Call changeStatus.mockRejectedValue to perform this step.
    changeStatus.mockRejectedValue(dbError);
    // Call expireStripeCheckoutSession.mockRejectedValue to perform this step.
    expireStripeCheckoutSession.mockRejectedValue(expireError);

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(expireStripeCheckoutSession).toHaveBeenCalledWith(stripeSession.id);
    // Assert that the value matches the intended expectation.
    expect(reservationSql.reserveCheckoutAttempt).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(logger.error).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the err field value.
        err: expireError,
        // Provide the original err field value.
        originalErr: dbError,
        // Provide the stripe session id field value.
        stripeSessionId: stripeSession.id,
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the correlation id field value.
        correlationId: 'corr-db-fail',
      }),
      // Supply the literal value used by the enclosing expression.
      'Failed to expire orphan Stripe checkout session after reservation update failure'
    );
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'reservation_stripe_session_link_failed',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the stripe expire attempted field value.
        stripeExpireAttempted: true,
        // Provide the stripe expire failed field value.
        stripeExpireFailed: true,
        // Provide the message field value.
        message: dbError.message,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  // Define a single test case and its expectations.
  test('redirects to Stripe when reservation update succeeds', async () => {
    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(expireStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the idempotency key field value.
        idempotencyKey: 'checkout:reservation:42:attempt1',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the type field value.
      type: 'redirect',
      // Provide the status code field value.
      statusCode: 303,
      // Provide the url field value.
      url: stripeSession.url,
    });
  });

  // Define a single test case and its expectations.
  test('reuses an open Stripe session when the amount still matches', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_active',
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_previous_active',
      // Provide the url field value.
      url: 'https://stripe.test/checkout/cs_previous_active',
      // Provide the status field value.
      status: 'open',
      // Provide the payment status field value.
      payment_status: 'unpaid',
      // Provide the amount total field value.
      amount_total: 12000,
    });

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the type field value.
      type: 'redirect',
      // Provide the status code field value.
      statusCode: 303,
      // Provide the url field value.
      url: 'https://stripe.test/checkout/cs_previous_active',
    });
  });

  // Define a single test case and its expectations.
  test('expires previous stripe session before creating when the amount changed', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_active',
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Reference the identifier used by the enclosing expression.
    retrieveStripeCheckoutSession
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 'cs_previous_active',
        // Provide the url field value.
        url: 'https://stripe.test/checkout/cs_previous_active',
        // Provide the status field value.
        status: 'open',
        // Provide the payment status field value.
        payment_status: 'unpaid',
        // Provide the amount total field value.
        amount_total: 9999,
      })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 'cs_previous_active',
        // Provide the status field value.
        status: 'expired',
        // Provide the payment status field value.
        payment_status: 'unpaid',
      });
    // Call safeExpireSupersededCheckoutSession.mockResolvedValue to perform this step.
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: true, expired: true });

    // Wait until the asynchronous operation resolves.
    await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(safeExpireSupersededCheckoutSession).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'cs_previous_active',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: '42' })
    );
    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('refuses to create when previous session expire is inconclusive', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_active',
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_previous_active',
      // Provide the url field value.
      url: 'https://stripe.test/checkout/cs_previous_active',
      // Provide the status field value.
      status: 'open',
      // Provide the payment status field value.
      payment_status: 'unpaid',
      // Provide the amount total field value.
      amount_total: 9999,
    });
    // Call safeExpireSupersededCheckoutSession.mockResolvedValue to perform this step.
    safeExpireSupersededCheckoutSession.mockResolvedValue({ ok: false, error: new Error('stripe down') });

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  // Define a single test case and its expectations.
  test('continues checkout when previous stripe session is already expired', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_expired',
        // Provide the status field value.
        status: 'pending_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_previous_expired',
      // Provide the status field value.
      status: 'expired',
      // Provide the payment status field value.
      payment_status: 'unpaid',
    });

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(safeExpireSupersededCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.type).toBe('redirect');
    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('blocks new checkout when previous stripe session is already paid', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_paid',
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_previous_paid',
      // Provide the status field value.
      status: 'complete',
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
    });

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'superseded_stripe_session_already_paid',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_previous_paid',
        // Provide the reservation id field value.
        reservationId: '42',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Your payment is being reviewed. Please contact support if you need help.',
      })
    );
  });

  // Define a single test case and its expectations.
  test('refuses to create when the existing Stripe session cannot be retrieved', async () => {
    // Call mockResolvedReservation to perform this step.
    mockResolvedReservation(
      {
        // Spread reservationDoc into the surrounding structure.
        ...reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_missing',
        // Provide the status field value.
        status: 'processing_payment',
      },
      // Supply the literal value used by the enclosing expression.
      false
    );
    // Call retrieveStripeCheckoutSession.mockRejectedValue to perform this step.
    retrieveStripeCheckoutSession.mockRejectedValue(new Error('No such checkout.session'));

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });

  // Define a single test case and its expectations.
  test('returns clean error when checkout lock stays busy', async () => {
    // Create the err constant.
    const err = new Error('Checkout lock busy');
    // Update err.code with the right-hand side value.
    err.code = 'CHECKOUT_LOCK_BUSY';
    // Call withReservationCheckoutLock.mockRejectedValueOnce to perform this step.
    withReservationCheckoutLock.mockRejectedValueOnce(err);

    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Assert that the value matches the intended expectation.
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.findById).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the type field value.
        type: 'renderOrderPage',
        // Provide the message field value.
        message: 'Unable to start payment. Please try again in a minute.',
      })
    );
  });
});
