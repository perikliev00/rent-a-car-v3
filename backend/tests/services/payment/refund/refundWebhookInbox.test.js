// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/paymentEventSqlService', () => ({
  // Provide the insert payment event field value.
  insertPaymentEvent: jest.fn(),
  // Provide the find by event id field value.
  findByEventId: jest.fn(),
  // Provide the update payment event status field value.
  updatePaymentEventStatus: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/refund/refundWebhookService', () => ({
  // Provide the apply refund from stripe object field value.
  applyRefundFromStripeObject: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/monitoring/track', () => ({
  // Provide the track webhook failure field value.
  trackWebhookFailure: jest.fn(),
  // Provide the track payment failure field value.
  trackPaymentFailure: jest.fn(),
}));

// Require the '../../../../src/services/sql/paymentEventSqlService' module as paymentEventSql.
const paymentEventSql = require('../../../../src/services/sql/paymentEventSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundWebhookService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  claimRefundInbox,
  // Contribute this line to the enclosing declaration or statement.
  handleRefundWebhookEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildRefundInboxPayload,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundWebhookInbox');

// Declare a test suite grouping related cases.
describe('refundWebhookInbox', () => {
  // Create the event constant.
  const event = {
    // Provide the id field value.
    id: 'evt_1',
    // Provide the type field value.
    type: 'refund.updated',
    // Provide the data field value.
    data: {
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: 're_1',
        // Provide the object field value.
        object: 'refund',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the metadata field value.
        metadata: { reservationId: '7' },
      },
    },
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('claim persists payload and received status', async () => {
    // Call paymentEventSql.insertPaymentEvent.mockResolvedValue to perform this step.
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the event id field value.
      event_id: 'evt_1',
      // Provide the status field value.
      status: 'received',
      // Provide the payload field value.
      payload: buildRefundInboxPayload(event, event.data.object),
    });

    // Create the claimed constant.
    const claimed = await claimRefundInbox(event, event.data.object);

    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.insertPaymentEvent).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the event id field value.
        eventId: 'evt_1',
        // Provide the event type field value.
        eventType: 'refund.updated',
        // Provide the status field value.
        status: 'received',
        // Provide the payload field value.
        payload: expect.objectContaining({
          // Provide the id field value.
          id: 'evt_1',
          // Provide the type field value.
          type: 'refund.updated',
          // Provide the data field value.
          data: { object: event.data.object },
        }),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(claimed.row.payload).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(claimed.duplicate).toBe(false);
  });

  // Define a single test case and its expectations.
  test('unique conflict does not insert a second row', async () => {
    // Create the unique err constant.
    const uniqueErr = new Error('duplicate');
    // Update uniqueErr.code with the right-hand side value.
    uniqueErr.code = '23505';
    // Call paymentEventSql.insertPaymentEvent.mockRejectedValue to perform this step.
    paymentEventSql.insertPaymentEvent.mockRejectedValue(uniqueErr);
    // Call paymentEventSql.findByEventId.mockResolvedValue to perform this step.
    paymentEventSql.findByEventId.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the event id field value.
      event_id: 'evt_1',
      // Provide the status field value.
      status: 'processed',
    });

    // Create the claimed constant.
    const claimed = await claimRefundInbox(event, event.data.object);

    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.insertPaymentEvent).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.findByEventId).toHaveBeenCalledWith('evt_1');
    // Assert that the value matches the intended expectation.
    expect(claimed.duplicate).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(claimed.row.status).toBe('processed');
  });

  // Define a single test case and its expectations.
  test('updates received to processed on handled apply', async () => {
    // Call paymentEventSql.insertPaymentEvent.mockResolvedValue to perform this step.
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the event id field value.
      event_id: 'evt_1',
      // Provide the status field value.
      status: 'received',
    });
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });
    // Call paymentEventSql.updatePaymentEventStatus.mockResolvedValue to perform this step.
    paymentEventSql.updatePaymentEventStatus.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'processed',
    });

    // Create the result constant.
    const result = await handleRefundWebhookEvent(event, { requestId: 'r1' });

    // Assert that the value matches the intended expectation.
    expect(result.statusCode).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(1, 'processed');
  });

  // Define a single test case and its expectations.
  test('updates received to ignored on partial mismatch', async () => {
    // Call paymentEventSql.insertPaymentEvent.mockResolvedValue to perform this step.
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the event id field value.
      event_id: 'evt_1',
      // Provide the status field value.
      status: 'received',
    });
    // Call applyRefundFromStripeObject.mockResolvedValue to perform this step.
    applyRefundFromStripeObject.mockResolvedValue({
      // Provide the handled field value.
      handled: false,
      // Provide the reason field value.
      reason: 'partial_or_amount_mismatch',
    });
    // Call paymentEventSql.updatePaymentEventStatus.mockResolvedValue to perform this step.
    paymentEventSql.updatePaymentEventStatus.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'ignored',
    });

    // Create the result constant.
    const result = await handleRefundWebhookEvent(event, { requestId: 'r1' });

    // Assert that the value matches the intended expectation.
    expect(result.statusCode).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(1, 'ignored');
  });
});
