jest.mock('../../../../src/repositories/reservationRepository', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  findOrderByReservationId: jest.fn(),
}));
jest.mock('../../../../src/services/sql/reservationSqlService', () => ({
  findByIdForUpdate: jest.fn(),
  applyStatusChange: jest.fn(),
}));
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  insertRefundOperation: jest.fn(),
  findByIdempotencyKey: jest.fn(),
  findActiveByReservationId: jest.fn(),
  findLatestByReservationId: jest.fn(),
  findByStripeRefundId: jest.fn(),
  findByPaymentIntentId: jest.fn(),
  findById: jest.fn(),
  updateRefundOperation: jest.fn(),
}));
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
}));
jest.mock('../../../../src/services/payment/stripeRefundService', () => ({
  createRefund: jest.fn(),
  retrieveRefund: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/resolvePaymentIntent', () => {
  const actual = jest.requireActual(
    '../../../../src/services/payment/refund/resolvePaymentIntent'
  );
  return {
    ...actual,
    resolvePaymentIntentForReservation: jest.fn(),
  };
});
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  logSystemAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../src/db/transaction', () => ({
  runWithTransaction: async (fn) => fn(null),
  isUniqueViolation: () => false,
}));

const reservationRepository = require('../../../../src/repositories/reservationRepository');
const reservationSql = require('../../../../src/services/sql/reservationSqlService');
const orderSql = require('../../../../src/services/sql/orderSqlService');
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
const {
  createRefund,
  retrieveRefund,
} = require('../../../../src/services/payment/stripeRefundService');
const {
  resolvePaymentIntentForReservation,
} = require('../../../../src/services/payment/refund/resolvePaymentIntent');
const {
  requestReservationRefund,
} = require('../../../../src/services/payment/refund/reservationRefundService');

describe('reservationRefundService.requestReservationRefund', () => {
  const req = { session: { user: { id: 9 } } };

  beforeEach(() => {
    jest.clearAllMocks();
    orderSql.findOrderByReservationId.mockResolvedValue({ id: 77, status: 'active' });
    resolvePaymentIntentForReservation.mockResolvedValue({
      paymentIntentId: 'pi_1',
      amountCents: 10000,
      currency: 'eur',
      source: 'reservation',
    });
    changeStatus.mockImplementation(async ({ reservationId, newStatus, patch }) => ({
      reservation: {
        id: reservationId,
        status: newStatus,
        stripePaymentIntentId: patch?.stripePaymentIntentId || 'pi_1',
        totalPrice: 100,
      },
      changed: true,
    }));
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findLatestByReservationId.mockResolvedValue(null);
  });

  test('happy path: Stripe succeeded applies refunded status', async () => {
    reservationRepository.findById
      .mockResolvedValueOnce({
        id: 1,
        status: 'confirmed',
        totalPrice: 100,
        stripePaymentIntentId: 'pi_1',
      })
      .mockResolvedValueOnce({
        id: 1,
        status: 'confirmed',
        totalPrice: 100,
        stripePaymentIntentId: 'pi_1',
      })
      .mockResolvedValue({
        id: 1,
        status: 'refunded',
        totalPrice: 100,
        stripePaymentIntentId: 'pi_1',
      });

    refundOpSql.findActiveByReservationId
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 10,
        status: 'pending',
        reservationId: 1,
        idempotencyKey: 'refund:reservation:1:full',
      });

    refundOpSql.insertRefundOperation.mockResolvedValue({
      id: 10,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });

    createRefund.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
      payment_intent: 'pi_1',
      amount: 10000,
    });

    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      id,
      reservationId: 1,
      status: patch.status || 'pending',
      stripeRefundId: patch.stripeRefundId || 're_1',
      idempotencyKey: 'refund:reservation:1:full',
    }));

    const result = await requestReservationRefund(req, { reservationId: 1 });

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'pi_1',
        idempotencyKey: 'refund:reservation:1:full',
      })
    );
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'refunded' })
    );
    expect(result.status).toBe('succeeded');
  });

  test('idempotent when already succeeded', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'refunded',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'succeeded',
      reservationId: 1,
    });

    const result = await requestReservationRefund(req, { reservationId: 1 });
    expect(result.status).toBe('succeeded');
    expect(result.idempotent).toBe(true);
    expect(createRefund).not.toHaveBeenCalled();
  });

  test('refunded with no ledger row is REFUND_LEDGER_INCONSISTENT', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'refunded',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_LEDGER_INCONSISTENT',
      status: 409,
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  test('refunded with pending ledger is REFUND_LEDGER_INCONSISTENT', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'refunded',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'pending',
      reservationId: 1,
    });

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_LEDGER_INCONSISTENT',
      status: 409,
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  test('locked refunded without succeeded ledger is REFUND_LEDGER_INCONSISTENT', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'refunded',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_LEDGER_INCONSISTENT',
      status: 409,
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  test('pending Stripe refund does not change reservation to refunded', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
    refundOpSql.insertRefundOperation.mockResolvedValue({
      id: 10,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });
    createRefund.mockResolvedValue({
      id: 're_pending',
      status: 'pending',
      payment_intent: 'pi_1',
    });
    refundOpSql.updateRefundOperation.mockResolvedValue({
      id: 10,
      status: 'pending',
      stripeRefundId: 're_pending',
      reservationId: 1,
    });

    const result = await requestReservationRefund(req, { reservationId: 1 });
    expect(result.status).toBe('pending');
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: 'pending',
        stripeRefundId: 're_pending',
        stripeRawStatus: 'pending',
        failureCode: null,
        failureMessage: null,
      })
    );
    expect(changeStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'refunded' })
    );
  });

  test('pending persist no-op on succeeded ledger does not report pending', async () => {
    const succeededOp = {
      id: 10,
      status: 'succeeded',
      reservationId: 1,
      stripeRefundId: 're_1',
      idempotencyKey: 'refund:reservation:1:full',
    };
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findActiveByReservationId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(succeededOp);
    refundOpSql.insertRefundOperation.mockResolvedValue({
      id: 10,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });
    createRefund.mockResolvedValue({
      id: 're_1',
      status: 'pending',
      payment_intent: 'pi_1',
    });
    refundOpSql.updateRefundOperation.mockResolvedValue(null);
    refundOpSql.findById.mockResolvedValue(succeededOp);

    const result = await requestReservationRefund(req, { reservationId: 1 });

    expect(result.status).toBe('succeeded');
    expect(result.status).not.toBe('pending');
    expect(changeStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'refunded' })
    );
  });

  test('rejects picked_up status', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'picked_up',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'picked_up',
      stripePaymentIntentId: 'pi_1',
      totalPrice: 100,
    });

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_NOT_ALLOWED',
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  test('rejects when no payment intent', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
    });
    resolvePaymentIntentForReservation.mockRejectedValue(
      Object.assign(new Error('no pi'), {
        code: 'REFUND_NO_PAYMENT_INTENT',
        status: 422,
      })
    );

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_NO_PAYMENT_INTENT',
    });
  });

  test('confirmed failed refund then retry creates with attempt2, not :full', async () => {
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
    refundOpSql.findLatestByReservationId.mockResolvedValue({
      id: 10,
      status: 'failed',
      reservationId: 1,
      stripeRefundId: 're_old',
      stripeRawStatus: 'failed',
      idempotencyKey: 'refund:reservation:1:full',
    });
    retrieveRefund.mockResolvedValue({ id: 're_old', status: 'failed' });
    refundOpSql.insertRefundOperation.mockResolvedValue({
      id: 11,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full:attempt2',
    });
    createRefund.mockResolvedValue({
      id: 're_2',
      status: 'succeeded',
      payment_intent: 'pi_1',
      amount: 10000,
    });
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      id,
      reservationId: 1,
      status: patch.status || 'pending',
      stripeRefundId: patch.stripeRefundId || 're_2',
      idempotencyKey: 'refund:reservation:1:full:attempt2',
    }));

    const result = await requestReservationRefund(req, { reservationId: 1 });

    expect(retrieveRefund).toHaveBeenCalledWith('re_old');
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      })
    );
    expect(createRefund).not.toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'refund:reservation:1:full',
      })
    );
    expect(result.status).toBe('succeeded');
  });

  test('timeout with no refund id leaves pending; second call retries same key', async () => {
    const pendingNoId = {
      id: 10,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
      stripeRefundId: null,
    };
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findActiveByReservationId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(pendingNoId);
    refundOpSql.insertRefundOperation.mockResolvedValue(pendingNoId);
    const timeoutErr = new Error('connect timeout');
    timeoutErr.type = 'StripeConnectionError';
    timeoutErr.code = 'ETIMEDOUT';
    createRefund
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce({
        id: 're_1',
        status: 'succeeded',
        payment_intent: 'pi_1',
        amount: 10000,
      });
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      id,
      reservationId: 1,
      status: patch.status || 'pending',
      stripeRefundId: patch.stripeRefundId || 're_1',
      idempotencyKey: 'refund:reservation:1:full',
    }));

    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      code: 'REFUND_INDETERMINATE',
      status: 503,
    });
    expect(refundOpSql.updateRefundOperation).not.toHaveBeenCalled();
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'refund:reservation:1:full',
      })
    );

    const result = await requestReservationRefund(req, { reservationId: 1 });

    expect(createRefund).toHaveBeenCalledTimes(2);
    expect(createRefund.mock.calls[1][0].idempotencyKey).toBe('refund:reservation:1:full');
    expect(createRefund).not.toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      })
    );
    expect(result.status).toBe('succeeded');
  });

  test('timeout with existing stripeRefundId retrieves and applies; createRefund not called', async () => {
    const pendingWithId = {
      id: 10,
      status: 'pending',
      reservationId: 1,
      stripeRefundId: 're_1',
      idempotencyKey: 'refund:reservation:1:full',
    };
    reservationRepository.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      totalPrice: 100,
      stripePaymentIntentId: 'pi_1',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(pendingWithId);
    retrieveRefund.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
      payment_intent: 'pi_1',
      amount: 10000,
    });
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      id,
      reservationId: 1,
      status: patch.status || 'succeeded',
      stripeRefundId: patch.stripeRefundId || 're_1',
      idempotencyKey: 'refund:reservation:1:full',
    }));

    const result = await requestReservationRefund(req, { reservationId: 1 });

    expect(retrieveRefund).toHaveBeenCalledWith('re_1');
    expect(createRefund).not.toHaveBeenCalled();
    expect(result.status).toBe('succeeded');
  });
});
