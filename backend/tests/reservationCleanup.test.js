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
jest.mock('../src/repositories/reservationRepository', () => ({
  // Provide the find processing with expired hold field value.
  findProcessingWithExpiredHold: jest.fn(),
  // Provide the mark expired field value.
  markExpired: jest.fn(),
  // Provide the mark abandoned field value.
  markAbandoned: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn().mockResolvedValue({ changed: true }),
  // Provide the record initial status field value.
  recordInitialStatus: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/sql/sessionSqlService', () => ({
  // Provide the list active session ids field value.
  listActiveSessionIds: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/bookingFinalizationService', () => ({
  // Provide the finalize reservation by stripe session id field value.
  finalizeReservationByStripeSessionId: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../src/services/admin/adminAuditService', () => ({
  // Provide the log customer action field value.
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../src/utils/logger', () => ({
  // Provide the info field value.
  info: jest.fn(),
  // Provide the error field value.
  error: jest.fn(),
}));

// Require the '../src/config/stripe' module as stripe.
const stripe = require('../src/config/stripe');
// Require the '../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../src/repositories/reservationRepository');
// Destructure object properties into local variables.
const { changeStatus } = require('../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  finalizeReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../src/services/bookingFinalizationService');
// Destructure object properties into local variables.
const { reconcileProcessingStripeReservations } = require('../src/services/reservationService');

// Define the buildProcessingReservation function.
function buildProcessingReservation(overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: '42',
    // Provide the status field value.
    status: 'processing_payment',
    // Provide the stripe session id field value.
    stripeSessionId: 'cs_cleanup',
    // Provide the session id field value.
    sessionId: 'sess_abc',
    // Provide the car id field value.
    carId: { id: '7', name: 'BMW X5' },
    // Provide the hold expires at field value.
    holdExpiresAt: new Date('2020-01-01T00:00:00Z'),
    // Provide the total price field value.
    totalPrice: 120,
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Declare a test suite grouping related cases.
describe('reconcileProcessingStripeReservations', () => {
  // Create the now constant.
  const now = new Date('2026-06-29T12:00:00Z');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call reservationRepository.findProcessingWithExpiredHold.mockResolvedValue to perform this step.
    reservationRepository.findProcessingWithExpiredHold.mockResolvedValue([
      // Call buildProcessingReservation to perform this step.
      buildProcessingReservation(),
    ]);
    // Call reservationRepository.markExpired.mockResolvedValue to perform this step.
    reservationRepository.markExpired.mockResolvedValue(true);
    // Call finalizeReservationByStripeSessionId.mockResolvedValue to perform this step.
    finalizeReservationByStripeSessionId.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: true,
      // Provide the reason field value.
      reason: 'finalized',
    });
  });

  // Define a single test case and its expectations.
  test('A: keeps processing when hold expired but Stripe checkout session is open', async () => {
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_cleanup',
      // Provide the status field value.
      status: 'open',
      // Provide the payment status field value.
      payment_status: 'unpaid',
    });

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(now);

    // Assert that the value matches the intended expectation.
    expect(result.kept).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(result.expired).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('B: finalizes when hold expired and Stripe payment_status is paid', async () => {
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_cleanup',
      // Provide the status field value.
      status: 'complete',
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
    });

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(now);

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(result.expired).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'cs_cleanup',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the stripe session payment status field value.
        stripeSessionPaymentStatus: 'paid',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('B: returns already_confirmed without expiring when order already exists', async () => {
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_cleanup',
      // Provide the status field value.
      status: 'complete',
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
    });
    // Call finalizeReservationByStripeSessionId.mockResolvedValue to perform this step.
    finalizeReservationByStripeSessionId.mockResolvedValue({
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reason field value.
      reason: 'already_confirmed',
    });

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(now);

    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('C: marks expired when hold expired and Stripe session is expired and unpaid', async () => {
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_cleanup',
      // Provide the status field value.
      status: 'expired',
      // Provide the payment status field value.
      payment_status: 'unpaid',
    });

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(now);

    // Assert that the value matches the intended expectation.
    expect(result.expired).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(result.kept).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the new status field value.
        newStatus: 'expired',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('parallel reconcile runs both attempt finalize without throwing', async () => {
    // Call stripe.checkout.sessions.retrieve.mockResolvedValue to perform this step.
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      // Provide the id field value.
      id: 'cs_cleanup',
      // Provide the status field value.
      status: 'complete',
      // Provide the payment status field value.
      payment_status: 'paid',
      // Provide the amount total field value.
      amount_total: 12000,
      // Provide the currency field value.
      currency: 'eur',
    });

    // Initialize the mutable calls variable.
    let calls = 0;
    // Call finalizeReservationByStripeSessionId.mockImplementation to perform this step.
    finalizeReservationByStripeSessionId.mockImplementation(async () => {
      // Update calls with the right-hand side value.
      calls += 1;
      // Wait until the asynchronous operation resolves.
      await new Promise((resolve) => setTimeout(resolve, 15));
      // Return the resulting value to the caller.
      return {
        // Provide the found field value.
        found: true,
        // Provide the finalized field value.
        finalized: calls === 1,
        // Provide the reason field value.
        reason: calls === 1 ? 'finalized' : 'already_confirmed',
      };
    });

    // Destructure array values into local variables.
    const [first, second] = await Promise.all([
      // Call reconcileProcessingStripeReservations to perform this step.
      reconcileProcessingStripeReservations(now),
      // Call reconcileProcessingStripeReservations to perform this step.
      reconcileProcessingStripeReservations(now),
    ]);

    // Assert that the value matches the intended expectation.
    expect(finalizeReservationByStripeSessionId).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(first.finalized + second.finalized).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markExpired).not.toHaveBeenCalled();
  });
});

// Declare a test suite grouping related cases.
describe('cleanUpAbandonedReservations overlapping runs', () => {
  // Require the '../src/services/sql/sessionSqlService' module as sessionSql.
  const sessionSql = require('../src/services/sql/sessionSqlService');
  // Destructure object properties into local variables.
  const { cleanUpAbandonedReservations } = require('../src/services/reservationService');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call sessionSql.listActiveSessionIds.mockResolvedValue to perform this step.
    sessionSql.listActiveSessionIds.mockResolvedValue(['sid-active']);
    // Call reservationRepository.markAbandoned.mockResolvedValue to perform this step.
    reservationRepository.markAbandoned.mockResolvedValue({
      // Provide the count field value.
      count: 1,
      // Provide the reservation ids field value.
      reservationIds: ['99'],
    });
    // Call reservationRepository.findProcessingWithExpiredHold.mockResolvedValue to perform this step.
    reservationRepository.findProcessingWithExpiredHold.mockResolvedValue([]);
  });

  // Define a single test case and its expectations.
  test('parallel cleanup invocations both call markAbandoned safely', async () => {
    // Wait until the asynchronous operation resolves.
    await Promise.all([cleanUpAbandonedReservations(), cleanUpAbandonedReservations()]);

    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markAbandoned).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(reservationRepository.markAbandoned).toHaveBeenCalledWith(
      // Contribute this line to the enclosing declaration or statement.
      ['sid-active'],
      // Call expect.any to perform this step.
      expect.any(Date)
    );
  });
});
