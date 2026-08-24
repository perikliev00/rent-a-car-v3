jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  findByStripeRefundId: jest.fn(),
  findByPaymentIntentId: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/applyRefundService', () => ({
  applySucceededRefund: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/refundLedgerService', () => ({
  markRefundFailed: jest.fn(),
}));
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');
const { markRefundFailed } = require('../../../../src/services/payment/refund/refundLedgerService');
const {
  applyRefundFromStripeObject,
} = require('../../../../src/services/payment/refund/refundWebhookService');

const LEDGER_OP = {
  id: 10,
  reservationId: 1,
  status: 'pending',
  stripePaymentIntentId: 'pi_1',
  stripeRefundId: 're_1',
  amountCents: 10000,
  currency: 'eur',
};

describe('applyRefundFromStripeObject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refundOpSql.findByStripeRefundId.mockImplementation(async (refundId) =>
      refundId ? LEDGER_OP : null
    );
    refundOpSql.findByPaymentIntentId.mockImplementation(async (paymentIntentId) =>
      paymentIntentId ? LEDGER_OP : null
    );
    applySucceededRefund.mockResolvedValue({
      status: 'succeeded',
      refundOperation: LEDGER_OP,
      applied: true,
    });
    markRefundFailed.mockResolvedValue({ ...LEDGER_OP, status: 'failed' });
  });

  test('partial charge.refunded must NOT apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'charge',
        id: 'ch_1',
        status: 'succeeded',
        refunded: false,
        amount: 10000,
        amount_refunded: 2500,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'charge.refunded' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  test('full charge.refunded DOES apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'charge',
        id: 'ch_1',
        status: 'succeeded',
        refunded: true,
        amount: 10000,
        amount_refunded: 10000,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'charge.refunded' }
    );

    expect(applySucceededRefund).toHaveBeenCalledTimes(1);
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toMatchObject({ handled: true, status: 'succeeded' });
  });

  test('partial refund.updated must NOT apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'succeeded',
        amount: 2500,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'refund.updated' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  test('full refund.updated DOES apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'succeeded',
        amount: 10000,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'refund.updated' }
    );

    expect(applySucceededRefund).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ handled: true, status: 'succeeded' });
  });

  test('currency mismatch does not apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'succeeded',
        amount: 10000,
        currency: 'usd',
        payment_intent: 'pi_1',
      },
      { eventType: 'refund.updated' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  test('payment_intent mismatch does not apply', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'succeeded',
        amount: 10000,
        currency: 'eur',
        payment_intent: 'pi_OTHER',
      },
      { eventType: 'refund.updated' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  test('refund.failed marks ledger failed', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'failed',
        amount: 10000,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'refund.failed' }
    );

    expect(markRefundFailed).toHaveBeenCalledTimes(1);
    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(result).toEqual({
      handled: true,
      status: 'failed',
      refundOperation: LEDGER_OP,
    });
  });

  test('refund.created pending does not refund domain', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_1',
        status: 'pending',
        amount: 10000,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'refund.created' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({
      handled: true,
      status: 'pending',
      refundOperation: LEDGER_OP,
    });
  });

  test('charge.status succeeded must never be enough', async () => {
    const result = await applyRefundFromStripeObject(
      {
        object: 'charge',
        id: 'ch_1',
        status: 'succeeded',
        refunded: false,
        amount: 10000,
        amount_refunded: 0,
        currency: 'eur',
        payment_intent: 'pi_1',
      },
      { eventType: 'charge.refunded' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  test('no matching ledger row', async () => {
    refundOpSql.findByStripeRefundId.mockResolvedValue(null);
    refundOpSql.findByPaymentIntentId.mockResolvedValue(null);

    const result = await applyRefundFromStripeObject(
      {
        object: 'refund',
        id: 're_missing',
        status: 'succeeded',
        amount: 10000,
        currency: 'eur',
        payment_intent: 'pi_missing',
      },
      { eventType: 'refund.updated' }
    );

    expect(applySucceededRefund).not.toHaveBeenCalled();
    expect(markRefundFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, reason: 'no_matching_operation' });
  });
});
