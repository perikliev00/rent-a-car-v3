jest.mock('../../../../src/services/sql/paymentEventSqlService', () => ({
  insertPaymentEvent: jest.fn(),
  findByEventId: jest.fn(),
  updatePaymentEventStatus: jest.fn(),
}));
jest.mock('../../../../src/services/payment/refund/refundWebhookService', () => ({
  applyRefundFromStripeObject: jest.fn(),
}));
jest.mock('../../../../src/monitoring/track', () => ({
  trackWebhookFailure: jest.fn(),
  trackPaymentFailure: jest.fn(),
}));

const paymentEventSql = require('../../../../src/services/sql/paymentEventSqlService');
const {
  applyRefundFromStripeObject,
} = require('../../../../src/services/payment/refund/refundWebhookService');
const {
  claimRefundInbox,
  handleRefundWebhookEvent,
  buildRefundInboxPayload,
} = require('../../../../src/services/payment/refund/refundWebhookInbox');

describe('refundWebhookInbox', () => {
  const event = {
    id: 'evt_1',
    type: 'refund.updated',
    data: {
      object: {
        id: 're_1',
        object: 'refund',
        status: 'succeeded',
        metadata: { reservationId: '7' },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('claim persists payload and received status', async () => {
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      id: 1,
      event_id: 'evt_1',
      status: 'received',
      payload: buildRefundInboxPayload(event, event.data.object),
    });

    const claimed = await claimRefundInbox(event, event.data.object);

    expect(paymentEventSql.insertPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_1',
        eventType: 'refund.updated',
        status: 'received',
        payload: expect.objectContaining({
          id: 'evt_1',
          type: 'refund.updated',
          data: { object: event.data.object },
        }),
      })
    );
    expect(claimed.row.payload).toBeTruthy();
    expect(claimed.duplicate).toBe(false);
  });

  test('unique conflict does not insert a second row', async () => {
    const uniqueErr = new Error('duplicate');
    uniqueErr.code = '23505';
    paymentEventSql.insertPaymentEvent.mockRejectedValue(uniqueErr);
    paymentEventSql.findByEventId.mockResolvedValue({
      id: 1,
      event_id: 'evt_1',
      status: 'processed',
    });

    const claimed = await claimRefundInbox(event, event.data.object);

    expect(paymentEventSql.insertPaymentEvent).toHaveBeenCalledTimes(1);
    expect(paymentEventSql.findByEventId).toHaveBeenCalledWith('evt_1');
    expect(claimed.duplicate).toBe(true);
    expect(claimed.row.status).toBe('processed');
  });

  test('updates received to processed on handled apply', async () => {
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      id: 1,
      event_id: 'evt_1',
      status: 'received',
    });
    applyRefundFromStripeObject.mockResolvedValue({ handled: true, status: 'succeeded' });
    paymentEventSql.updatePaymentEventStatus.mockResolvedValue({
      id: 1,
      status: 'processed',
    });

    const result = await handleRefundWebhookEvent(event, { requestId: 'r1' });

    expect(result.statusCode).toBe(200);
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(1, 'processed');
  });

  test('updates received to ignored on partial mismatch', async () => {
    paymentEventSql.insertPaymentEvent.mockResolvedValue({
      id: 1,
      event_id: 'evt_1',
      status: 'received',
    });
    applyRefundFromStripeObject.mockResolvedValue({
      handled: false,
      reason: 'partial_or_amount_mismatch',
    });
    paymentEventSql.updatePaymentEventStatus.mockResolvedValue({
      id: 1,
      status: 'ignored',
    });

    const result = await handleRefundWebhookEvent(event, { requestId: 'r1' });

    expect(result.statusCode).toBe(200);
    expect(paymentEventSql.updatePaymentEventStatus).toHaveBeenCalledWith(1, 'ignored');
  });
});
