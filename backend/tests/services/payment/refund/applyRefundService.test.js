jest.mock('../../../../src/repositories/reservationRepository', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  findActiveByReservationId: jest.fn(),
  findById: jest.fn(),
  updateRefundOperation: jest.fn(),
}));
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
}));
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../src/db/transaction', () => ({
  runWithTransaction: async (fn) => fn(null),
}));

const reservationRepository = require('../../../../src/repositories/reservationRepository');
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
const { logSystemAction } = require('../../../../src/services/admin/adminAuditService');
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');

const PENDING_OP = {
  id: 10,
  reservationId: 1,
  status: 'pending',
  stripeRefundId: 're_1',
  stripePaymentIntentId: 'pi_1',
};

describe('applySucceededRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refundOpSql.findActiveByReservationId.mockResolvedValue(PENDING_OP);
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      ...PENDING_OP,
      id,
      ...patch,
      status: patch.status || PENDING_OP.status,
    }));
  });

  test('happy path applies refunded domain status', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
    });
    changeStatus.mockResolvedValue({
      reservation: { id: 1, status: 'refunded' },
      changed: true,
    });

    const result = await applySucceededRefund({
      refundOperation: PENDING_OP,
      reservationId: 1,
      stripeRefund: { id: 're_1', status: 'succeeded' },
    });

    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ status: 'succeeded' }),
      null
    );
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 1, newStatus: 'refunded' })
    );
    expect(result.status).toBe('succeeded');
    expect(result.domainApplied).not.toBe(false);
  });

  test('Stripe-already-succeeded + illegal transition keeps ledger succeeded', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'picked_up',
    });
    const transitionErr = new Error('Invalid reservation status transition: picked_up → refunded');
    transitionErr.code = 'INVALID_STATUS_TRANSITION';
    transitionErr.status = 422;
    transitionErr.fromStatus = 'picked_up';
    transitionErr.toStatus = 'refunded';
    changeStatus.mockRejectedValue(transitionErr);

    const result = await applySucceededRefund({
      refundOperation: PENDING_OP,
      reservationId: 1,
      stripeRefund: { id: 're_1', status: 'succeeded' },
    });

    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ status: 'succeeded' }),
      null
    );
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        failureCode: 'DOMAIN_TRANSITION_FAILED',
        failureMessage: 'picked_up → refunded',
      }),
      null
    );
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'refunded' })
    );
    expect(changeStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'manual_review' })
    );
    expect(result.status).toBe('succeeded');
    expect(result.domainApplied).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.refundOperation.status).not.toBe('failed');
    expect(logSystemAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.refund_domain_transition_failed' })
    );
  });

  test('already refunded reservation is idempotent', async () => {
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      ...PENDING_OP,
      status: 'succeeded',
    });
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'refunded',
    });

    const result = await applySucceededRefund({
      refundOperation: { ...PENDING_OP, status: 'succeeded' },
      reservationId: 1,
    });

    expect(result.status).toBe('succeeded');
    expect(result.applied).toBe(false);
    expect(changeStatus).not.toHaveBeenCalled();
    expect(refundOpSql.updateRefundOperation).not.toHaveBeenCalled();
  });
});
