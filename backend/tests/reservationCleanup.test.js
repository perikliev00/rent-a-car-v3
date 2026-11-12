jest.mock('../src/config/stripe', () => ({
  checkout: {
    sessions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('../src/repositories/reservationRepository', () => ({
  findProcessingWithExpiredHold: jest.fn(),
  markExpired: jest.fn(),
  markAbandoned: jest.fn(),
}));

jest.mock('../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn().mockResolvedValue({ changed: true }),
  recordInitialStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/sql/sessionSqlService', () => ({
  listActiveSessionIds: jest.fn(),
}));

jest.mock('../src/services/bookingFinalizationService', () => ({
  finalizeReservationByStripeSessionId: jest.fn(),
}));

jest.mock('../src/services/admin/adminAuditService', () => ({
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
  logSystemAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const stripe = require('../src/config/stripe');
const reservationRepository = require('../src/repositories/reservationRepository');
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
const {
  finalizeReservationByStripeSessionId,
} = require('../src/services/bookingFinalizationService');
const { reconcileProcessingStripeReservations } = require('../src/services/reservationService');

function buildProcessingReservation(overrides = {}) {
  return {
    id: '42',
    status: 'processing_payment',
    stripeSessionId: 'cs_cleanup',
    sessionId: 'sess_abc',
    carId: { id: '7', name: 'BMW X5' },
    holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
    totalPrice: 120,
    ...overrides,
  };
}

describe('reconcileProcessingStripeReservations', () => {
  const now = new Date('2026-06-29T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    reservationRepository.findProcessingWithExpiredHold.mockResolvedValue([
      buildProcessingReservation(),
    ]);
    reservationRepository.markExpired.mockResolvedValue(true);
    finalizeReservationByStripeSessionId.mockResolvedValue({
      found: true,
      finalized: true,
      reason: 'finalized',
    });
  });

  test('A: keeps processing when hold expired but Stripe checkout session is open', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_cleanup',
      status: 'open',
      payment_status: 'unpaid',
    });

    const result = await reconcileProcessingStripeReservations(now);

    expect(result.kept).toBe(1);
    expect(result.expired).toBe(0);
    expect(result.finalized).toBe(0);
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  test('B: finalizes when hold expired and Stripe payment_status is paid', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_cleanup',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
    });

    const result = await reconcileProcessingStripeReservations(now);

    expect(result.finalized).toBe(1);
    expect(result.expired).toBe(0);
    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledWith(
      'cs_cleanup',
      expect.objectContaining({
        reservationId: '42',
        stripeSessionPaymentStatus: 'paid',
      })
    );
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
  });

  test('B: returns already_confirmed without expiring when order already exists', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_cleanup',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
    });
    finalizeReservationByStripeSessionId.mockResolvedValue({
      found: true,
      finalized: false,
      reason: 'already_confirmed',
    });

    const result = await reconcileProcessingStripeReservations(now);

    expect(result.finalized).toBe(1);
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
  });

  test('C: marks expired when hold expired and Stripe session is expired and unpaid', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_cleanup',
      status: 'expired',
      payment_status: 'unpaid',
    });

    const result = await reconcileProcessingStripeReservations(now);

    expect(result.expired).toBe(1);
    expect(result.kept).toBe(0);
    expect(result.finalized).toBe(0);
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: '42',
        newStatus: 'expired',
      })
    );
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  test('parallel reconcile runs both attempt finalize without throwing', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_cleanup',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 12000,
      currency: 'eur',
    });

    let calls = 0;
    finalizeReservationByStripeSessionId.mockImplementation(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        found: true,
        finalized: calls === 1,
        reason: calls === 1 ? 'finalized' : 'already_confirmed',
      };
    });

    const [first, second] = await Promise.all([
      reconcileProcessingStripeReservations(now),
      reconcileProcessingStripeReservations(now),
    ]);

    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledTimes(2);
    expect(first.finalized + second.finalized).toBe(2);
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
  });
});

describe('cleanUpAbandonedReservations overlapping runs', () => {
  const sessionSql = require('../src/services/sql/sessionSqlService');
  const { cleanUpAbandonedReservations } = require('../src/services/reservationService');

  beforeEach(() => {
    jest.clearAllMocks();
    sessionSql.listActiveSessionIds.mockResolvedValue(['sid-active']);
    reservationRepository.markAbandoned.mockResolvedValue({
      count: 1,
      reservationIds: ['99'],
    });
    reservationRepository.findProcessingWithExpiredHold.mockResolvedValue([]);
  });

  test('parallel cleanup invocations both call markAbandoned safely', async () => {
    await Promise.all([cleanUpAbandonedReservations(), cleanUpAbandonedReservations()]);

    expect(reservationRepository.markAbandoned).toHaveBeenCalledTimes(2);
    expect(reservationRepository.markAbandoned).toHaveBeenCalledWith(
      ['sid-active'],
      expect.any(Date)
    );
  });
});
