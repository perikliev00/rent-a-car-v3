jest.mock('../src/config/stripe', () => ({
  checkout: {
    sessions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('../src/services/sql/processedStripeEventSqlService', () => ({
  insertProcessedEvent: jest.fn(),
}));

jest.mock('../src/repositories/reservationRepository', () => ({
  findByStripeSessionId: jest.fn(),
  findById: jest.fn(),
  findActiveBySessionId: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(async ({ reservationId, newStatus, patch = null }) => ({
    reservation: {
      id: String(reservationId),
      status: newStatus,
      carId: { id: '7', name: 'BMW X5' },
      pickupDate: new Date('2026-07-01'),
      returnDate: new Date('2026-07-05'),
      totalPrice: 120,
      email: 'guest@example.com',
      ...(patch || {}),
    },
    changed: true,
    oldStatus: 'processing_payment',
    newStatus,
  })),
}));

jest.mock('../src/services/sql/orderSqlService', () => ({
  findOrderByReservationId: jest.fn(),
  findOrderByStripeSessionId: jest.fn(),
  createOrderFromReservation: jest.fn(),
}));

jest.mock('../src/services/sql/bookingSyncSqlService', () => ({
  addRange: jest.fn(),
}));

jest.mock('../src/services/sql/paymentEventSqlService', () => ({
  insertPaymentEvent: jest.fn(),
}));

jest.mock('../src/services/sql/paymentFailureSqlService', () => ({
  markFailuresResolvedByStripeSession: jest.fn(),
}));

jest.mock('../src/services/email/bookingEmailService', () => ({
  sendBookingConfirmationEmails: jest.fn(),
}));

jest.mock('../src/monitoring/track', () => ({
  trackPaymentFailure: jest.fn(),
}));

jest.mock('../src/services/admin/adminAuditService', () => ({
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/db/transaction', () => ({
  runWithTransaction: jest.fn(async (fn) => fn({})),
  isUniqueViolation: jest.requireActual('../src/db/transaction').isUniqueViolation,
}));

const stripe = require('../src/config/stripe');
const stripeEventSql = require('../src/services/sql/processedStripeEventSqlService');
const reservationRepository = require('../src/repositories/reservationRepository');
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
const orderSql = require('../src/services/sql/orderSqlService');
const { addRange } = require('../src/services/sql/bookingSyncSqlService');
const { trackPaymentFailure } = require('../src/monitoring/track');
const {
  processStripeWebhookEvent,
  finalizeReservationByStripeSessionId,
} = require('../src/services/bookingFinalizationService');

function buildActiveReservation(overrides = {}) {
  return {
    id: '42',
    status: 'processing_payment',
    carId: { id: '7', name: 'BMW X5' },
    pickupDate: new Date('2026-07-01'),
    pickupTime: '10:00',
    returnDate: new Date('2026-07-05'),
    returnTime: '18:00',
    sessionId: 'sess_abc',
    totalPrice: 120,
    fullName: 'Jane Doe',
    email: 'guest@example.com',
    phoneNumber: '+359888123456',
    holdExpiresAt: new Date('2099-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('processStripeWebhookEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stripeEventSql.insertProcessedEvent.mockResolvedValue(true);
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_ok' })
    );
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    orderSql.createOrderFromReservation.mockResolvedValue({ id: '99', email: 'guest@example.com' });
    // status via changeStatus mock
    addRange.mockResolvedValue(undefined);
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
    });
  });

  test('Test 1: finalizes normally when hold is active and Stripe session is paid', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_ok' })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_ok',
      stripeSessionId: 'cs_ok',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.finalized).toBe(true);
    expect(result.reason).toBe('finalized');
    expect(addRange).toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        newStatus: 'paid',
        patch: expect.objectContaining({
          paidAmountCents: 12000,
          paidCurrency: 'eur',
        }),
      })
    );
  });

  test('rejects stale stripe session when metadata points to reservation with newer active session', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    reservationRepository.findById.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_new_active',
        status: 'processing_payment',
      })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_stale',
      stripeSessionId: 'cs_old_stale',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'unpaid',
    });

    expect(result.finalized).toBe(false);
    expect(result.reason).toBe('stale_stripe_session');
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'stale_stripe_session',
      expect.objectContaining({
        reservationId: '42',
        stripeSessionId: 'cs_old_stale',
        activeSessionId: 'cs_new_active',
      })
    );
  });

  test('marks manual review when stale stripe session was paid', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    reservationRepository.findById.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_new_active',
        status: 'processing_payment',
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_stale_paid',
      stripeSessionId: 'cs_old_paid',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).toBe('stale_stripe_session');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  test('rejects when stripe amount_total does not match reservation totalPrice', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_amount' })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_amount',
      stripeSessionId: 'cs_amount',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 9999,
      stripeSessionCurrency: 'eur',
    });

    expect(result.finalized).toBe(false);
    expect(result.reason).toBe('stripe_amount_mismatch');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  test('rejects when stripe currency is not eur', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_currency' })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_currency',
      stripeSessionId: 'cs_currency',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'usd',
    });

    expect(result.finalized).toBe(false);
    expect(result.reason).toBe('stripe_currency_mismatch');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  test('finalizes via orphan recovery when reservation has no linked stripeSessionId', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    reservationRepository.findById.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: undefined,
        status: 'processing_payment',
      })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_orphan',
      stripeSessionId: 'cs_orphan_link',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.finalized).toBe(true);
    expect(result.reason).toBe('finalized');
  });

  test('returns not_found when reservation cannot be resolved', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(null);
    reservationRepository.findById.mockResolvedValue(null);
    reservationRepository.findActiveBySessionId.mockResolvedValue(null);

    const result = await processStripeWebhookEvent({
      eventId: 'evt_missing',
      stripeSessionId: 'cs_missing',
      reservationId: '999',
      stripeSessionPaymentStatus: 'paid',
    });

    expect(result.reason).toBe('not_found');
  });

  test('returns already_confirmed for confirmed reservations with orders', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue({
      id: '42',
      status: 'confirmed',
      carId: { id: '7' },
      stripeSessionId: 'cs_confirmed',
      totalPrice: 120,
    });
    orderSql.findOrderByReservationId.mockResolvedValue({ id: '99' });

    const result = await processStripeWebhookEvent({
      eventId: 'evt_confirmed',
      stripeSessionId: 'cs_confirmed',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).toBe('already_confirmed');
    expect(addRange).not.toHaveBeenCalled();
  });

  test('D: recovers paid webhook when local reservation is already expired', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_expired_local',
        status: 'expired',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_expired_local',
      stripeSessionId: 'cs_expired_local',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).not.toBe('status_not_active');
    expect(result.finalized).toBe(true);
    expect(result.reason).toBe('finalized');
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
  });

  test('D: marks manual_review when expired reservation has paid webhook and overlap', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_expired_overlap',
        status: 'expired',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_expired_overlap',
      stripeSessionId: 'cs_expired_overlap',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).toBe('overlap_after_payment');
    expect(result.reason).not.toBe('status_not_active');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  test('Test 2: returns hold_expired when hold expired and Stripe session is unpaid', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_expired_hold',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_expired_hold',
      stripeSessionId: 'cs_expired_hold',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'unpaid',
    });

    expect(result.reason).toBe('hold_expired');
    expect(result.finalized).toBe(false);
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  test('Test 3: finalizes paid reservation after expired hold when availability is clear', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_paid_expired_hold',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_paid_expired_hold',
      stripeSessionId: 'cs_paid_expired_hold',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.finalized).toBe(true);
    expect(result.reason).toBe('finalized');
    expect(addRange).toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'confirmed' }));
  });

  test('Test 4: marks overlap_after_payment when hold expired, session paid, and dates overlap', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_paid_conflict',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_paid_conflict',
      stripeSessionId: 'cs_paid_conflict',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
      logPrefix: '[WebhookTest]',
    });

    expect(result.finalized).toBe(false);
    expect(result.reason).toBe('overlap_after_payment');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'overlap_after_payment',
      expect.objectContaining({
        reservationId: '42',
        stripeSessionId: 'cs_paid_conflict',
        carId: '7',
        paidAmount: 120,
        fullName: 'Jane Doe',
        email: 'guest@example.com',
        phoneNumber: '+359888123456',
        pickupTime: '10:00',
        returnTime: '18:00',
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  test('Test 5: duplicate webhook invocation remains idempotent', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_idempotent' })
    );
    stripeEventSql.insertProcessedEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const payload = {
      eventId: 'evt_idempotent',
      stripeSessionId: 'cs_idempotent',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    };

    const first = await processStripeWebhookEvent(payload);
    const second = await processStripeWebhookEvent(payload);

    expect(first.finalized).toBe(true);
    expect(second.reason).toBe('duplicate_event');
    expect(addRange).toHaveBeenCalledTimes(1);
    expect(orderSql.createOrderFromReservation).toHaveBeenCalledTimes(1);
  });

  test('B: returns payment_not_paid for unpaid Stripe session without attempting overlap handling', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_unpaid_overlap' })
    );
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));

    const result = await finalizeReservationByStripeSessionId('cs_unpaid_overlap', {
      stripeSessionPaymentStatus: 'unpaid',
    });

    expect(result.found).toBe(true);
    expect(result.finalized).toBe(false);
    expect(result.reason).toBe('payment_not_paid');
    expect(addRange).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  test('C: returns already_confirmed when order exists for stripe session without manual review', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({ stripeSessionId: 'cs_existing_order' })
    );
    orderSql.findOrderByStripeSessionId.mockResolvedValue({ id: '88', reservationId: '42' });

    const result = await processStripeWebhookEvent({
      eventId: 'evt_existing_order',
      stripeSessionId: 'cs_existing_order',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).toBe('already_confirmed');
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
  });

  test('D: stores admin metadata on paid webhook overlap', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_meta_overlap',
        stripePaymentIntentId: 'pi_from_reservation',
      })
    );
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_meta_overlap',
      stripeSessionId: 'cs_meta_overlap',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
      stripePaymentIntent: 'pi_webhook_456',
    });

    expect(result.reason).toBe('overlap_after_payment');
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'overlap_after_payment',
      expect.objectContaining({
        reservationId: '42',
        stripeSessionId: 'cs_meta_overlap',
        stripePaymentIntent: 'pi_webhook_456',
        carId: '7',
        fullName: 'Jane Doe',
        email: 'guest@example.com',
        phoneNumber: '+359888123456',
        pickupTime: '10:00',
        returnTime: '18:00',
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  test('E: paid webhook overlap with missing optional fields still marks manual review', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_sparse_overlap',
        fullName: undefined,
        email: undefined,
        phoneNumber: undefined,
        pickupTime: undefined,
        returnTime: undefined,
        stripePaymentIntentId: undefined,
      })
    );
    addRange.mockRejectedValue(Object.assign(new Error('overlap'), { code: 'OVERLAP' }));
    // status via changeStatus mock

    const result = await processStripeWebhookEvent({
      eventId: 'evt_sparse_overlap',
      stripeSessionId: 'cs_sparse_overlap',
      stripeSessionPaymentStatus: 'paid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
    });

    expect(result.reason).toBe('overlap_after_payment');
    expect(result.status).toBe('manual_review');
    expect(changeStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: 'manual_review' }));
    expect(trackPaymentFailure).toHaveBeenCalledWith(
      'overlap_after_payment',
      expect.objectContaining({
        reservationId: '42',
        stripeSessionId: 'cs_sparse_overlap',
        conflictReason: 'overlap_after_payment',
      })
    );
  });

  test('returns status_not_active for cancelled reservation when webhook is unpaid', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        status: 'cancelled',
        stripeSessionId: 'cs_cancelled_unpaid',
        holdExpiresAt: new Date('2099-01-01T00:00:00Z'),
      })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_cancelled_unpaid',
      stripeSessionId: 'cs_cancelled_unpaid',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'unpaid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
      logPrefix: '[Test]',
    });

    expect(result.reason).toBe('status_not_active');
    expect(result.finalized).toBe(false);
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
  });

  test('returns status_not_active for expired unpaid reservation when requireActiveStatus', async () => {
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        status: 'expired',
        stripeSessionId: 'cs_expired_unpaid',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );

    const result = await processStripeWebhookEvent({
      eventId: 'evt_expired_unpaid',
      stripeSessionId: 'cs_expired_unpaid',
      reservationId: '42',
      carId: '7',
      sessionId: 'sess_abc',
      stripeSessionPaymentStatus: 'unpaid',
      stripeSessionAmountTotal: 12000,
      stripeSessionCurrency: 'eur',
      logPrefix: '[Test]',
    });

    expect(result.reason).toBe('status_not_active');
    expect(result.finalized).toBe(false);
    expect(addRange).not.toHaveBeenCalled();
  });
});

describe('finalizeReservationByStripeSessionId payment status fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationRepository.findByStripeSessionId.mockResolvedValue(
      buildActiveReservation({
        stripeSessionId: 'cs_retrieve_paid',
        holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    orderSql.findOrderByStripeSessionId.mockResolvedValue(null);
    orderSql.createOrderFromReservation.mockResolvedValue({ id: '99' });
    // status via changeStatus mock
    addRange.mockResolvedValue(undefined);
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
    });
  });

  test('retrieves Stripe payment status when hold expired and status not provided', async () => {
    const result = await finalizeReservationByStripeSessionId('cs_retrieve_paid');

    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_retrieve_paid');
    expect(result.finalized).toBe(true);
    expect(result.reason).toBe('finalized');
  });
});
