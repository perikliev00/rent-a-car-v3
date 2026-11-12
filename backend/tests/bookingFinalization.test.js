// Call jest.mock to perform this step.
jest.mock('../src/config/stripe', () => ({
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
jest.mock('../src/services/sql/processedStripeEventSqlService', () => ({
  // Provide the insert processed event field value.
  insertProcessedEvent: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/repositories/reservationRepository', () => ({
  // Provide the find by stripe session id field value.
  findByStripeSessionId: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the find active by session id field value.
  findActiveBySessionId: jest.fn(),
  // Provide the update field value.
  update: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(async ({ reservationId, newStatus, patch = null }) => ({
    // Provide the reservation field value.
    reservation: {
      // Provide the id field value.
      id: String(reservationId),
      // Provide the status field value.
      status: newStatus,
      // Provide the car id field value.
      carId: { id: '7', name: 'BMW X5' },
      // Provide the pickup date field value.
      pickupDate: new Date('2026-07-01'),
      // Provide the return date field value.
      returnDate: new Date('2026-07-05'),
      // Provide the total price field value.
      totalPrice: 120,
      // Provide the email field value.
      email: 'guest@example.com',
      // Call ... to perform this step.
      ...(patch || {}),
    },
    // Provide the changed field value.
    changed: true,
    // Provide the old status field value.
    oldStatus: 'processing_payment',
    // Contribute this line to the enclosing declaration or statement.
    newStatus,
  })),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/orderSqlService', () => ({
  // Provide the find order by reservation id field value.
  findOrderByReservationId: jest.fn(),
  // Provide the find order by stripe session id field value.
  findOrderByStripeSessionId: jest.fn(),
  // Provide the create order from reservation field value.
  createOrderFromReservation: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the add range field value.
  addRange: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/paymentEventSqlService', () => ({
  // Provide the insert payment event field value.
  insertPaymentEvent: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/paymentFailureSqlService', () => ({
  // Provide the mark failures resolved by stripe session field value.
  markFailuresResolvedByStripeSession: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/email/bookingEmailService', () => ({
  // Provide the send booking confirmation emails field value.
  sendBookingConfirmationEmails: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/monitoring/track', () => ({
  // Provide the track payment failure field value.
  trackPaymentFailure: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/admin/adminAuditService', () => ({
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: jest.fn(async (fn) => fn({})),
  // Provide the is unique violation field value.
  isUniqueViolation: jest.requireActual('../src/db/transaction').isUniqueViolation,
}));

// Require the '../src/config/stripe' module as stripe.
const stripe = require('../src/config/stripe');
// Require the '../src/services/sql/processedStripeEventSqlService' module as stripeEventSql.
const stripeEventSql = require('../src/services/sql/processedStripeEventSqlService');
// Require the '../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../src/repositories/reservationRepository');
// Destructure object properties into local variables.
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
// Require the '../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../src/services/sql/orderSqlService');
// Destructure object properties into local variables.
const { addRange } = require('../src/services/sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../src/monitoring/track');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  processStripeWebhookEvent,
  // Contribute this line to the enclosing declaration or statement.
  finalizeReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../src/services/bookingFinalizationService');

// Define the buildActiveReservation function.
function buildActiveReservation(overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: '42',
    // Provide the status field value.
    status: 'processing_payment',
    // Provide the car id field value.
    carId: { id: '7', name: 'BMW X5' },
    // Provide the pickup date field value.
    pickupDate: new Date('2026-07-01'),
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return date field value.
    returnDate: new Date('2026-07-05'),
    // Provide the return time field value.
    returnTime: '18:00',
    // Provide the session id field value.
    sessionId: 'sess_abc',
    // Provide the total price field value.
    totalPrice: 120,
    // Provide the full name field value.
    fullName: 'Jane Doe',
    // Provide the email field value.
    email: 'guest@example.com',
    // Provide the phone number field value.
    phoneNumber: '+359888123456',
    // Provide the hold expires at field value.
    holdExpiresAt: new Date('2099-01-01T00:00:00Z'),
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Declare a test suite grouping related cases.
describe('processStripeWebhookEvent', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call stripeEventSql.insertProcessedEvent.mockResolvedValue to perform this step.
    stripeEventSql.insertProcessedEvent.mockResolvedValue(true);
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_ok' })
    );
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    // Call orderSql.findOrderByStripeSessionId.mockResolvedValue to perform this step.
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    // Call orderSql.createOrderFromReservation.mockResolvedValue to perform this step.
    orderSql.createOrderFromReservation.mockResolvedValue({ id: '99', email: 'guest@example.com' });
    // status via changeStatus mock
    addRange.mockResolvedValue(undefined);
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
    });
  });

  // Define a single test case and its expectations.
  test('Test 1: finalizes normally when hold is active and Stripe session is paid', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_ok' })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_ok',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_ok',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('finalized');
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the new status field value.
        newStatus: 'paid',
        // Provide the patch field value.
        patch: expect.objectContaining({
          // Provide the paid amount cents field value.
          paidAmountCents: 12000,
          // Provide the paid currency field value.
          paidCurrency: 'eur',
        }),
      })
    );
  });

  // Define a single test case and its expectations.
  test('rejects stale stripe session when metadata points to reservation with newer active session', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_new_active',
        // Provide the status field value.
        status: 'processing_payment',
      })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_stale',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_old_stale',
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the car id field value.
      carId: '7',
      // Provide the session id field value.
      sessionId: 'sess_abc',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'unpaid',
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('stale_stripe_session');
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'stale_stripe_session',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_old_stale',
        // Provide the active session id field value.
        activeSessionId: 'cs_new_active',
      })
    );
  });

  // Define a single test case and its expectations.
  test('marks manual review when stale stripe session was paid', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_new_active',
        // Provide the status field value.
        status: 'processing_payment',
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_stale_paid',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_old_paid',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('stale_stripe_session');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  // Define a single test case and its expectations.
  test('rejects when stripe amount_total does not match reservation totalPrice', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_amount' })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_amount',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_amount',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 9999,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('stripe_amount_mismatch');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('rejects when stripe currency is not eur', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_currency' })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_currency',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_currency',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'usd',
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('stripe_currency_mismatch');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('finalizes via orphan recovery when reservation has no linked stripeSessionId', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: undefined,
        // Provide the status field value.
        status: 'processing_payment',
      })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_orphan',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_orphan_link',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('finalized');
  });

  // Define a single test case and its expectations.
  test('returns not_found when reservation cannot be resolved', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue(null);
    // Call reservationRepository.findActiveBySessionId.mockResolvedValue to perform this step.
    reservationRepository.findActiveBySessionId.mockResolvedValue(null);

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_missing',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_missing',
      // Provide the reservation id field value.
      reservationId: '999',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('not_found');
  });

  // Define a single test case and its expectations.
  test('returns already_confirmed for confirmed reservations with orders', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue({
      // Provide the id field value.
      id: '42',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the car id field value.
      carId: { id: '7' },
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_confirmed',
      // Provide the total price field value.
      totalPrice: 120,
    });
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue({ id: '99' });

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_confirmed',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_confirmed',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('already_confirmed');
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('D: recovers paid webhook when local reservation is already expired', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_expired_local',
        // Provide the status field value.
        status: 'expired',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_expired_local',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_expired_local',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).not.toBe('status_not_active');
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('finalized');
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('D: marks manual_review when expired reservation has paid webhook and overlap', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_expired_overlap',
        // Provide the status field value.
        status: 'expired',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // Call addRange.mockRejectedValue to perform this step.
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_expired_overlap',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_expired_overlap',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('overlap_after_payment');
    // Assert that the value matches the intended expectation.
    expect(result.reason).not.toBe('status_not_active');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  // Define a single test case and its expectations.
  test('Test 2: returns hold_expired when hold expired and Stripe session is unpaid', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_expired_hold',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_expired_hold',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_expired_hold',
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the car id field value.
      carId: '7',
      // Provide the session id field value.
      sessionId: 'sess_abc',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'unpaid',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('hold_expired');
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('Test 3: finalizes paid reservation after expired hold when availability is clear', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_paid_expired_hold',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_paid_expired_hold',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_paid_expired_hold',
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
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('finalized');
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'confirmed' }));
  });

  // Define a single test case and its expectations.
  test('Test 4: marks overlap_after_payment when hold expired, session paid, and dates overlap', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_paid_conflict',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // Call addRange.mockRejectedValue to perform this step.
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_paid_conflict',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_paid_conflict',
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
      // Provide the log prefix field value.
      logPrefix: '[WebhookTest]',
    });

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('overlap_after_payment');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'overlap_after_payment',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_paid_conflict',
        // Provide the car id field value.
        carId: '7',
        // Provide the paid amount field value.
        paidAmount: 120,
        // Provide the full name field value.
        fullName: 'Jane Doe',
        // Provide the email field value.
        email: 'guest@example.com',
        // Provide the phone number field value.
        phoneNumber: '+359888123456',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the conflict reason field value.
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  // Define a single test case and its expectations.
  test('Test 5: duplicate webhook invocation remains idempotent', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_idempotent' })
    );
    // Call stripeEventSql.insertProcessedEvent.mockResolvedValueOnce to perform this step.
    stripeEventSql.insertProcessedEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    // Create the payload constant.
    const payload = {
      // Provide the event id field value.
      eventId: 'evt_idempotent',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_idempotent',
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
    };

    // Create the first constant.
    const first = await processStripeWebhookEvent(payload);
    // Create the second constant.
    const second = await processStripeWebhookEvent(payload);

    // Assert that the value matches the intended expectation.
    expect(first.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(second.reason).toBe('duplicate_event');
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).toHaveBeenCalledTimes(1);
  });

  // Define a single test case and its expectations.
  test('B: returns payment_not_paid for unpaid Stripe session without attempting overlap handling', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_unpaid_overlap' })
    );
    // Call addRange.mockRejectedValue to perform this step.
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));

    // Create the result constant.
    const result = await finalizeReservationByStripeSessionId('cs_unpaid_overlap', {
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'unpaid',
    });

    // Assert that the value matches the intended expectation.
    expect(result.found).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('payment_not_paid');
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  // Define a single test case and its expectations.
  test('C: returns already_confirmed when order exists for stripe session without manual review', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({ stripeSessionId: 'cs_existing_order' })
    );
    // Call orderSql.findOrderByStripeSessionId.mockResolvedValue to perform this step.
    orderSql.findOrderByStripeSessionId.mockResolvedValue({ id: '88', reservationId: '42' });

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_existing_order',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_existing_order',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('already_confirmed');
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  // Define a single test case and its expectations.
  test('D: stores admin metadata on paid webhook overlap', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_meta_overlap',
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_from_reservation',
      })
    );
    // Call addRange.mockRejectedValue to perform this step.
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_meta_overlap',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_meta_overlap',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
      // Provide the stripe payment intent field value.
      stripePaymentIntent: 'pi_webhook_456',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('overlap_after_payment');
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'overlap_after_payment',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_meta_overlap',
        // Provide the stripe payment intent field value.
        stripePaymentIntent: 'pi_webhook_456',
        // Provide the car id field value.
        carId: '7',
        // Provide the full name field value.
        fullName: 'Jane Doe',
        // Provide the email field value.
        email: 'guest@example.com',
        // Provide the phone number field value.
        phoneNumber: '+359888123456',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the conflict reason field value.
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  // Define a single test case and its expectations.
  test('E: paid webhook overlap with missing optional fields still marks manual review', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_sparse_overlap',
        // Provide the full name field value.
        fullName: undefined,
        // Provide the email field value.
        email: undefined,
        // Provide the phone number field value.
        phoneNumber: undefined,
        // Provide the pickup time field value.
        pickupTime: undefined,
        // Provide the return time field value.
        returnTime: undefined,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: undefined,
      })
    );
    // Call addRange.mockRejectedValue to perform this step.
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_sparse_overlap',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_sparse_overlap',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'paid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('overlap_after_payment');
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('manual_review');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    // Assert that the value matches the intended expectation.
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'overlap_after_payment',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_sparse_overlap',
        // Provide the conflict reason field value.
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  // Define a single test case and its expectations.
  test('returns status_not_active for cancelled reservation when webhook is unpaid', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the status field value.
        status: 'cancelled',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_cancelled_unpaid',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2099-01-01T00:00:00Z'),
      })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_cancelled_unpaid',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_cancelled_unpaid',
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the car id field value.
      carId: '7',
      // Provide the session id field value.
      sessionId: 'sess_abc',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'unpaid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
      // Provide the log prefix field value.
      logPrefix: '[Test]',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('status_not_active');
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns status_not_active for expired unpaid reservation when requireActiveStatus', async () => {
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the status field value.
        status: 'expired',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_expired_unpaid',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: 'evt_expired_unpaid',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_expired_unpaid',
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the car id field value.
      carId: '7',
      // Provide the session id field value.
      sessionId: 'sess_abc',
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: 'unpaid',
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: 12000,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: 'eur',
      // Provide the log prefix field value.
      logPrefix: '[Test]',
    });

    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('status_not_active');
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
  });
});

// Declare a test suite grouping related cases.
describe('finalizeReservationByStripeSessionId payment status fallback', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call reservationRepository.findByStripeSessionId.mockResolvedValue to perform this step.
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      // Call buildActiveReservation to perform this step.
      buildActiveReservation({
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_retrieve_paid',
        // Provide the hold expires at field value.
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    // Call orderSql.findOrderByStripeSessionId.mockResolvedValue to perform this step.
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    // Call orderSql.createOrderFromReservation.mockResolvedValue to perform this step.
    orderSql.createOrderFromReservation.mockResolvedValue({ id: '99' });
    // status via changeStatus mock
    addRange.mockResolvedValue(undefined);
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
    });
  });

  // Define a single test case and its expectations.
  test('retrieves Stripe payment status when hold expired and status not provided', async () => {
    // Create the result constant.
    const result = await finalizeReservationByStripeSessionId('cs_retrieve_paid');

    // Assert that the value matches the intended expectation.
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_retrieve_paid');
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('finalized');
  });
});
