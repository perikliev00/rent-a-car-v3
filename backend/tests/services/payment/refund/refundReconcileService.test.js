jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  findPendingOlderThan: jest.fn(),
  findFailedWithRefundIdOlderThan: jest.fn(),
}));
jest.mock('../../../../src/services/sql/paymentEventSqlService', () => ({
  listStuckReceivedRefundEvents: jest.fn(),
  updatePaymentEventStatus: jest.fn(),
}));
jest.mock('../../../../src/services/payment/stripeRefundService', () => ({
  retrieveRefund: jest.fn(),
  createRefund: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/applyRefundService', () => ({
  applySucceededRefund: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/refundLedgerService', () => ({
  markRefundFailed: jest.fn(),
  resurrectPending: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/refundWebhookService', () => ({
  applyRefundFromStripeObject: jest.fn(),
}));

const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
const paymentEventSql = require('../../../../src/services/sql/paymentEventSqlService');
const { retrieveRefund, createRefund } = require('../../../../src/services/payment/stripeRefundService');
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');
const {
  markRefundFailed,
  resurrectPending,
} = require('../../../../src/services/payment/refund/refundLedgerService');
const {
  applyRefundFromStripeObject,
} = require('../../../../src/services/payment/refund/refundWebhookService');
const {
  reconcilePendingRefunds,
} = require('../../../../src/services/payment/refund/refundReconcileService');

describe('reconcilePendingRefunds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refundOpSql.findPendingOlderThan.mockResolvedValue([]);
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([]);
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([]);
    paymentEventSql.updatePaymentEventStatus.mockImplementation(async (id, status) => ({
      id,
      status,
    }));
  });

  test('replays stuck received refund events with payload', async () => {
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        id: 3,
        event_id: 'evt_stuck',
        event_type: 'refund.updated',
        status: 'received',
        payload: {
          id: 'evt_stuck',
          type: 'refund.updated',
          data: {
            object: { id: 're_1', object: 'refund', status: 'succeeded' },
          },
        },
      },
    ]);
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 0, limit: 10 });

    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 're_1' }),
      expect.objectContaining({ eventType: 'refund.updated' })
    );
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(3, 'processed');
    expect(result.inbox.results[0].action).toBe('processed');
  });

  test('pending refund_operations reconcile still runs', async () => {
    refundOpSql.findPendingOlderThan.mockResolvedValue([
      {
        id: 10,
        reservationId: 1,
        stripeRefundId: 're_pending',
        status: 'pending',
      },
    ]);
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'succeeded' });
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    expect(retrieveRefund).toHaveBeenCalledWith('re_pending');
    expect(applySucceededRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 1, reason: 'refund_reconcile' })
    );
    expect(result.results[0].action).toBe('applied_succeeded');
    expect(markRefundFailed).not.toHaveBeenCalled();
  });

  test('apply throw on one inbox row does not abort the batch', async () => {
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        id: 1,
        event_id: 'evt_fail',
        event_type: 'refund.updated',
        status: 'received',
        payload: {
          type: 'refund.updated',
          data: { object: { id: 're_fail', object: 'refund' } },
        },
      },
      {
        id: 2,
        event_id: 'evt_ok',
        event_type: 'charge.refunded',
        status: 'received',
        payload: {
          type: 'charge.refunded',
          data: { object: { id: 'ch_ok', object: 'charge', refunded: true } },
        },
      },
    ]);
    applyRefundFromStripeObject
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ handled: true, status: 'succeeded' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 0, limit: 10 });

    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(2);
    expect(result.inbox.results[0].reason).toMatch(/apply_failed/);
    expect(paymentEventSql.updatePaymentEventStatus).not.toHaveBeenCalledWith(1, expect.anything());
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(2, 'processed');
    expect(result.inbox.results[1].action).toBe('processed');
  });

  test('failed + refund id, retrieve succeeded → applySucceededRefund', async () => {
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        id: 20,
        reservationId: 2,
        stripeRefundId: 're_failed',
        status: 'failed',
      },
    ]);
    retrieveRefund.mockResolvedValue({ id: 're_failed', status: 'succeeded' });
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    expect(retrieveRefund).toHaveBeenCalledWith('re_failed');
    expect(applySucceededRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 2, reason: 'refund_reconcile' })
    );
    expect(createRefund).not.toHaveBeenCalled();
    expect(result.results[0].action).toBe('applied_succeeded');
  });

  test('failed + refund id, retrieve pending → resurrect pending', async () => {
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        id: 21,
        reservationId: 3,
        stripeRefundId: 're_pending',
        status: 'failed',
      },
    ]);
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'pending' });
    resurrectPending.mockResolvedValue({ id: 21, status: 'pending' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    expect(resurrectPending).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21 }),
      expect.objectContaining({ stripeRefundId: 're_pending', stripeRawStatus: 'pending' })
    );
    expect(createRefund).not.toHaveBeenCalled();
    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(result.results[0].action).toBe('resurrected_pending');
  });

  test('failed + still Stripe-failed → no createRefund', async () => {
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        id: 22,
        reservationId: 4,
        stripeRefundId: 're_still_failed',
        status: 'failed',
      },
    ]);
    retrieveRefund.mockResolvedValue({ id: 're_still_failed', status: 'failed' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    expect(createRefund).not.toHaveBeenCalled();
    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result.results[0].action).toBe('left_failed');
  });

  test('existing pending + inbox replay still run with failed-with-id scan', async () => {
    refundOpSql.findPendingOlderThan.mockResolvedValue([
      {
        id: 10,
        reservationId: 1,
        stripeRefundId: 're_pending',
        status: 'pending',
      },
    ]);
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([]);
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'succeeded' });
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        id: 3,
        event_id: 'evt_stuck',
        event_type: 'refund.updated',
        status: 'received',
        payload: {
          type: 'refund.updated',
          data: { object: { id: 're_1', object: 'refund', status: 'succeeded' } },
        },
      },
    ]);
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });

    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    expect(applySucceededRefund).toHaveBeenCalled();
    expect(applyRefundFromStripeObject).toHaveBeenCalled();
    expect(result.results[0].action).toBe('applied_succeeded');
    expect(result.inbox.results[0].action).toBe('processed');
  });
});
