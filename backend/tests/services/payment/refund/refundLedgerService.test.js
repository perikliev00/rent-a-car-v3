jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  insertRefundOperation: jest.fn(),
  findById: jest.fn(),
  findByIdempotencyKey: jest.fn(),
  findActiveByReservationId: jest.fn(),
  updateRefundOperation: jest.fn(),
}));
jest.mock('../../../../src/services/sql/reservationSqlService', () => ({
  applyStatusChange: jest.fn(),
}));

const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
const {
  createPendingOperation,
  markRefundFailed,
} = require('../../../../src/services/payment/refund/refundLedgerService');

const uniqueErr = { code: '23505' };

function baseArgs() {
  return {
    reservation: { id: 1 },
    order: { id: 77 },
    paymentIntentId: 'pi_1',
    amountCents: 10000,
    currency: 'eur',
    reason: 'admin',
    requestedByUserId: 9,
  };
}

describe('refundLedgerService.createPendingOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
  });

  test('unique conflict, byKey failed → insert attempt2, do not return failed', async () => {
    refundOpSql.insertRefundOperation
      .mockRejectedValueOnce(uniqueErr)
      .mockResolvedValueOnce({
        id: 2,
        status: 'pending',
        reservationId: 1,
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      });
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      id: 1,
      status: 'failed',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });

    const op = await createPendingOperation(baseArgs());

    expect(op.status).toBe('pending');
    expect(op.id).toBe(2);
    expect(op.idempotencyKey).toBe('refund:reservation:1:full:attempt2');
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(2);
    expect(refundOpSql.insertRefundOperation.mock.calls[1][0].idempotencyKey).toBe(
      'refund:reservation:1:full:attempt2'
    );
  });

  test('unique conflict pending → return pending', async () => {
    refundOpSql.insertRefundOperation.mockRejectedValue(uniqueErr);
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      id: 1,
      status: 'pending',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });

    const op = await createPendingOperation(baseArgs());

    expect(op.status).toBe('pending');
    expect(op.id).toBe(1);
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(1);
  });

  test('unique conflict succeeded → return succeeded', async () => {
    refundOpSql.insertRefundOperation.mockRejectedValue(uniqueErr);
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      id: 1,
      status: 'succeeded',
      reservationId: 1,
      idempotencyKey: 'refund:reservation:1:full',
    });

    const op = await createPendingOperation(baseArgs());

    expect(op.status).toBe('succeeded');
    expect(op.id).toBe(1);
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(1);
  });
});

describe('refundLedgerService.markRefundFailed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('update null and find shows succeeded → returns succeeded, does not throw', async () => {
    refundOpSql.updateRefundOperation.mockResolvedValue(null);
    refundOpSql.findById.mockResolvedValue({
      id: 10,
      status: 'succeeded',
      reservationId: 1,
      stripeRefundId: 're_1',
    });

    const result = await markRefundFailed(
      { id: 10, status: 'pending' },
      { code: 'failed', message: 'race' }
    );

    expect(result.status).toBe('succeeded');
    expect(result.stripeRefundId).toBe('re_1');
    expect(refundOpSql.findById).toHaveBeenCalledWith(10, null);
  });
});
