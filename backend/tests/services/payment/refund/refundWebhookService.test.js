// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the find by stripe refund id field value.
  findByStripeRefundId: jest.fn(),
  // Provide the find by payment intent id field value.
  findByPaymentIntentId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/refund/applyRefundService', () => ({
  // Provide the apply succeeded refund field value.
  applySucceededRefund: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/refund/refundLedgerService', () => ({
  // Provide the mark refund failed field value.
  markRefundFailed: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

// Require the '../../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');
// Destructure object properties into local variables.
const { markRefundFailed } = require('../../../../src/services/payment/refund/refundLedgerService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundWebhookService');

// Create the ledger op constant.
const LEDGER_OP = {
  // Provide the id field value.
  id: 10,
  // Provide the reservation id field value.
  reservationId: 1,
  // Provide the status field value.
  status: 'pending',
  // Provide the stripe payment intent id field value.
  stripePaymentIntentId: 'pi_1',
  // Provide the stripe refund id field value.
  stripeRefundId: 're_1',
  // Provide the amount cents field value.
  amountCents: 10000,
  // Provide the currency field value.
  currency: 'eur',
};

// Declare a test suite grouping related cases.
describe('applyRefundFromStripeObject', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call refundOpSql.findByStripeRefundId.mockImplementation to perform this step.
    refundOpSql.findByStripeRefundId.mockImplementation(async (refundId) =>
      // Contribute this line to the enclosing declaration or statement.
      refundId ? LEDGER_OP : null
    );
    // Call refundOpSql.findByPaymentIntentId.mockImplementation to perform this step.
    refundOpSql.findByPaymentIntentId.mockImplementation(async (paymentIntentId) =>
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId ? LEDGER_OP : null
    );
    // Call applySucceededRefund.mockResolvedValue to perform this step.
    applySucceededRefund.mockResolvedValue({
      // Provide the status field value.
      status: 'succeeded',
      // Provide the refund operation field value.
      refundOperation: LEDGER_OP,
      // Provide the applied field value.
      applied: true,
    });
    // Call markRefundFailed.mockResolvedValue to perform this step.
    markRefundFailed.mockResolvedValue({ ...LEDGER_OP, status: 'failed' });
  });

  // Define a single test case and its expectations.
  test('partial charge.refunded must NOT apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'charge',
        // Provide the id field value.
        id: 'ch_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refunded field value.
        refunded: false,
        // Provide the amount field value.
        amount: 10000,
        // Provide the amount refunded field value.
        amount_refunded: 2500,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'charge.refunded' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  // Define a single test case and its expectations.
  test('full charge.refunded DOES apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'charge',
        // Provide the id field value.
        id: 'ch_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refunded field value.
        refunded: true,
        // Provide the amount field value.
        amount: 10000,
        // Provide the amount refunded field value.
        amount_refunded: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'charge.refunded' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toMatchObject({ handled: true, status: 'succeeded' });
  });

  // Define a single test case and its expectations.
  test('partial refund.updated must NOT apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount field value.
        amount: 2500,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.updated' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  // Define a single test case and its expectations.
  test('full refund.updated DOES apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.updated' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(result).toMatchObject({ handled: true, status: 'succeeded' });
  });

  // Define a single test case and its expectations.
  test('currency mismatch does not apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'usd',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.updated' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  // Define a single test case and its expectations.
  test('payment_intent mismatch does not apply', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_OTHER',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.updated' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  // Define a single test case and its expectations.
  test('refund.failed marks ledger failed', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'failed',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.failed' }
    );

    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the handled field value.
      handled: true,
      // Provide the status field value.
      status: 'failed',
      // Provide the refund operation field value.
      refundOperation: LEDGER_OP,
    });
  });

  // Define a single test case and its expectations.
  test('refund.created pending does not refund domain', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'pending',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.created' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the handled field value.
      handled: true,
      // Provide the status field value.
      status: 'pending',
      // Provide the refund operation field value.
      refundOperation: LEDGER_OP,
    });
  });

  // Define a single test case and its expectations.
  test('charge.status succeeded must never be enough', async () => {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'charge',
        // Provide the id field value.
        id: 'ch_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refunded field value.
        refunded: false,
        // Provide the amount field value.
        amount: 10000,
        // Provide the amount refunded field value.
        amount_refunded: 0,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'charge.refunded' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'partial_or_amount_mismatch' });
  });

  // Define a single test case and its expectations.
  test('no matching ledger row', async () => {
    // Call refundOpSql.findByStripeRefundId.mockResolvedValue to perform this step.
    refundOpSql.findByStripeRefundId.mockResolvedValue(null);
    // Call refundOpSql.findByPaymentIntentId.mockResolvedValue to perform this step.
    refundOpSql.findByPaymentIntentId.mockResolvedValue(null);

    // Create the result constant.
    const result = await applyRefundFromStripeObject(
      {
        // Provide the object field value.
        object: 'refund',
        // Provide the id field value.
        id: 're_missing',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount field value.
        amount: 10000,
        // Provide the currency field value.
        currency: 'eur',
        // Provide the payment intent field value.
        payment_intent: 'pi_missing',
      },
      // Contribute this line to the enclosing declaration or statement.
      { eventType: 'refund.updated' }
    );

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ handled: false, reason: 'no_matching_operation' });
  });
});
