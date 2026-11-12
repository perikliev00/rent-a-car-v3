// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/reservationRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the find active by reservation id field value.
  findActiveByReservationId: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the update refund operation field value.
  updateRefundOperation: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: async (fn) => fn(null),
}));

// Require the '../../../../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../../src/repositories/reservationRepository');
// Require the '../../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const { logSystemAction } = require('../../../../src/services/admin/adminAuditService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');

// Create the pending op constant.
const PENDING_OP = {
  // Provide the id field value.
  id: 10,
  // Provide the reservation id field value.
  reservationId: 1,
  // Provide the status field value.
  status: 'pending',
  // Provide the stripe refund id field value.
  stripeRefundId: 're_1',
  // Provide the stripe payment intent id field value.
  stripePaymentIntentId: 'pi_1',
};

// Declare a test suite grouping related cases.
describe('applySucceededRefund', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(PENDING_OP);
    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Spread PENDING_OP into the surrounding structure.
      ...PENDING_OP,
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Spread patch into the surrounding structure.
      ...patch,
      // Provide the status field value.
      status: patch.status || PENDING_OP.status,
    }));
  });

  // Define a single test case and its expectations.
  test('happy path applies refunded domain status', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
    });
    // Call changeStatus.mockResolvedValue to perform this step.
    changeStatus.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: 1, status: 'refunded' },
      // Provide the changed field value.
      changed: true,
    });

    // Create the result constant.
    const result = await applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: PENDING_OP,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund field value.
      stripeRefund: { id: 're_1', status: 'succeeded' },
    });

    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      10,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'succeeded' }),
      // Supply the literal value used by the enclosing expression.
      null
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: 1, newStatus: 'refunded' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.domainApplied).not.toBe(false);
  });

  // Define a single test case and its expectations.
  test('Stripe-already-succeeded + illegal transition keeps ledger succeeded', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'picked_up',
    });
    // Create the transition err constant.
    const transitionErr = new Error('Invalid reservation status transition: picked_up → refunded');
    // Update transitionErr.code with the right-hand side value.
    transitionErr.code = 'INVALID_STATUS_TRANSITION';
    // Update transitionErr.status with the right-hand side value.
    transitionErr.status = 422;
    // Update transitionErr.fromStatus with the right-hand side value.
    transitionErr.fromStatus = 'picked_up';
    // Update transitionErr.toStatus with the right-hand side value.
    transitionErr.toStatus = 'refunded';
    // Call changeStatus.mockRejectedValue to perform this step.
    changeStatus.mockRejectedValue(transitionErr);

    // Create the result constant.
    const result = await applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: PENDING_OP,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund field value.
      stripeRefund: { id: 're_1', status: 'succeeded' },
    });

    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      10,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'succeeded' }),
      // Supply the literal value used by the enclosing expression.
      null
    );
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      10,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the failure code field value.
        failureCode: 'DOMAIN_TRANSITION_FAILED',
        // Provide the failure message field value.
        failureMessage: 'picked_up → refunded',
      }),
      // Supply the literal value used by the enclosing expression.
      null
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'refunded' })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'manual_review' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.domainApplied).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.needsReview).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.refundOperation.status).not.toBe('failed');
    // Assert that the value matches the intended expectation.
    expect(logSystemAction).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ action: 'system.refund_domain_transition_failed' })
    );
  });

  // Define a single test case and its expectations.
  test('already refunded reservation is idempotent', async () => {
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Spread PENDING_OP into the surrounding structure.
      ...PENDING_OP,
      // Provide the status field value.
      status: 'succeeded',
    });
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'refunded',
    });

    // Create the result constant.
    const result = await applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: { ...PENDING_OP, status: 'succeeded' },
      // Provide the reservation id field value.
      reservationId: 1,
    });

    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.applied).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).not.toHaveBeenCalled();
  });
});
