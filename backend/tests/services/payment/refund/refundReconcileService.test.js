// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the find pending older than field value.
  findPendingOlderThan: jest.fn(),
  // Provide the find failed with refund id older than field value.
  findFailedWithRefundIdOlderThan: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/paymentEventSqlService', () => ({
  // Provide the list stuck received refund events field value.
  listStuckReceivedRefundEvents: jest.fn(),
  // Provide the update payment event status field value.
  updatePaymentEventStatus: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/stripeRefundService', () => ({
  // Provide the retrieve refund field value.
  retrieveRefund: jest.fn(),
  // Provide the create refund field value.
  createRefund: jest.fn(),
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
  // Provide the resurrect pending field value.
  resurrectPending: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/refund/refundWebhookService', () => ({
  // Provide the apply refund from stripe object field value.
  applyRefundFromStripeObject: jest.fn(),
}));

// Require the '../../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
// Require the '../../../../src/services/sql/paymentEventSqlService' module as paymentEventSql.
const paymentEventSql = require('../../../../src/services/sql/paymentEventSqlService');
// Destructure object properties into local variables.
const { retrieveRefund, createRefund } = require('../../../../src/services/payment/stripeRefundService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('../../../../src/services/payment/refund/applyRefundService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  markRefundFailed,
  // Contribute this line to the enclosing declaration or statement.
  resurrectPending,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundLedgerService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundWebhookService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  reconcilePendingRefunds,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundReconcileService');

// Declare a test suite grouping related cases.
describe('reconcilePendingRefunds', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call refundOpSql.findPendingOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findPendingOlderThan.mockResolvedValue([]);
    // Call refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([]);
    // Call paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue to perform this step.
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([]);
    // Call paymentEventSql.updatePaymentEventStatus.mockImplementation to perform this step.
    paymentEventSql.updatePaymentEventStatus.mockImplementation(async (id, status) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      status,
    }));
  });

  // Define a single test case and its expectations.
  test('replays stuck received refund events with payload', async () => {
    // Call paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue to perform this step.
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        // Provide the id field value.
        id: 3,
        // Provide the event id field value.
        event_id: 'evt_stuck',
        // Provide the event type field value.
        event_type: 'refund.updated',
        // Provide the status field value.
        status: 'received',
        // Provide the payload field value.
        payload: {
          // Provide the id field value.
          id: 'evt_stuck',
          // Provide the type field value.
          type: 'refund.updated',
          // Provide the data field value.
          data: {
            // Provide the object field value.
            object: { id: 're_1', object: 'refund', status: 'succeeded' },
          },
        },
      },
    ]);
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 0, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 're_1' }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ eventType: 'refund.updated' })
    );
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(3, 'processed');
    // Assert that the value matches the intended expectation.
    expect(result.inbox.results[0].action).toBe('processed');
  });

  // Define a single test case and its expectations.
  test('pending refund_operations reconcile still runs', async () => {
    // Call refundOpSql.findPendingOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findPendingOlderThan.mockResolvedValue([
      {
        // Provide the id field value.
        id: 10,
        // Provide the reservation id field value.
        reservationId: 1,
        // Provide the stripe refund id field value.
        stripeRefundId: 're_pending',
        // Provide the status field value.
        status: 'pending',
      },
    ]);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'succeeded' });
    // Call applySucceededRefund.mockResolvedValue to perform this step.
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(retrieveRefund).toHaveBeenCalledWith('re_pending');
    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: 1, reason: 'refund_reconcile' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.results[0].action).toBe('applied_succeeded');
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('apply throw on one inbox row does not abort the batch', async () => {
    // Call paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue to perform this step.
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        // Provide the id field value.
        id: 1,
        // Provide the event id field value.
        event_id: 'evt_fail',
        // Provide the event type field value.
        event_type: 'refund.updated',
        // Provide the status field value.
        status: 'received',
        // Provide the payload field value.
        payload: {
          // Provide the type field value.
          type: 'refund.updated',
          // Provide the data field value.
          data: { object: { id: 're_fail', object: 'refund' } },
        },
      },
      {
        // Provide the id field value.
        id: 2,
        // Provide the event id field value.
        event_id: 'evt_ok',
        // Provide the event type field value.
        event_type: 'charge.refunded',
        // Provide the status field value.
        status: 'received',
        // Provide the payload field value.
        payload: {
          // Provide the type field value.
          type: 'charge.refunded',
          // Provide the data field value.
          data: { object: { id: 'ch_ok', object: 'charge', refunded: true } },
        },
      },
    ]);
    // Reference the identifier used by the enclosing expression.
    applyRefundFromStripeObject
      // Call .mockRejectedValueOnce to perform this step.
      .mockRejectedValueOnce(new Error('boom'))
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ handled: true, status: 'succeeded' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 0, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(result.inbox.results[0].reason).toMatch(/apply_failed/);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.updatePaymentEventStatus).not.toHaveBeenCalledWith(1, expect.anything());
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(2, 'processed');
    // Assert that the value matches the intended expectation.
    expect(result.inbox.results[1].action).toBe('processed');
  });

  // Define a single test case and its expectations.
  test('failed + refund id, retrieve succeeded → applySucceededRefund', async () => {
    // Call refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        // Provide the id field value.
        id: 20,
        // Provide the reservation id field value.
        reservationId: 2,
        // Provide the stripe refund id field value.
        stripeRefundId: 're_failed',
        // Provide the status field value.
        status: 'failed',
      },
    ]);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_failed', status: 'succeeded' });
    // Call applySucceededRefund.mockResolvedValue to perform this step.
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(retrieveRefund).toHaveBeenCalledWith('re_failed');
    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: 2, reason: 'refund_reconcile' })
    );
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.results[0].action).toBe('applied_succeeded');
  });

  // Define a single test case and its expectations.
  test('failed + refund id, retrieve pending → resurrect pending', async () => {
    // Call refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        // Provide the id field value.
        id: 21,
        // Provide the reservation id field value.
        reservationId: 3,
        // Provide the stripe refund id field value.
        stripeRefundId: 're_pending',
        // Provide the status field value.
        status: 'failed',
      },
    ]);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'pending' });
    // Call resurrectPending.mockResolvedValue to perform this step.
    resurrectPending.mockResolvedValue({ id: 21, status: 'pending' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(resurrectPending).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 21 }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ stripeRefundId: 're_pending', stripeRawStatus: 'pending' })
    );
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.results[0].action).toBe('resurrected_pending');
  });

  // Define a single test case and its expectations.
  test('failed + still Stripe-failed → no createRefund', async () => {
    // Call refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([
      {
        // Provide the id field value.
        id: 22,
        // Provide the reservation id field value.
        reservationId: 4,
        // Provide the stripe refund id field value.
        stripeRefundId: 're_still_failed',
        // Provide the status field value.
        status: 'failed',
      },
    ]);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_still_failed', status: 'failed' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(markRefundFailed).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.results[0].action).toBe('left_failed');
  });

  // Define a single test case and its expectations.
  test('existing pending + inbox replay still run with failed-with-id scan', async () => {
    // Call refundOpSql.findPendingOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findPendingOlderThan.mockResolvedValue([
      {
        // Provide the id field value.
        id: 10,
        // Provide the reservation id field value.
        reservationId: 1,
        // Provide the stripe refund id field value.
        stripeRefundId: 're_pending',
        // Provide the status field value.
        status: 'pending',
      },
    ]);
    // Call refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue to perform this step.
    refundOpSql.findFailedWithRefundIdOlderThan.mockResolvedValue([]);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_pending', status: 'succeeded' });
    // Call applySucceededRefund.mockResolvedValue to perform this step.
    applySucceededRefund.mockResolvedValue({ status: 'succeeded' });
    // Call paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue to perform this step.
    paymentEventSql.listStuckReceivedRefundEvents.mockResolvedValue([
      {
        // Provide the id field value.
        id: 3,
        // Provide the event id field value.
        event_id: 'evt_stuck',
        // Provide the event type field value.
        event_type: 'refund.updated',
        // Provide the status field value.
        status: 'received',
        // Provide the payload field value.
        payload: {
          // Provide the type field value.
          type: 'refund.updated',
          // Provide the data field value.
          data: { object: { id: 're_1', object: 'refund', status: 'succeeded' } },
        },
      },
    ]);
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });

    // Create the result constant.
    const result = await reconcilePendingRefunds({ olderThanMinutes: 5, limit: 10 });

    // Assert that the value matches the intended expectation.
    expect(applySucceededRefund).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(applyRefundFromStripeObject).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.results[0].action).toBe('applied_succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.inbox.results[0].action).toBe('processed');
  });
});
