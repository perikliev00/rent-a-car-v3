jest.mock('../../src/monitoring/metrics', () => ({
  incrementPaymentFailures: jest.fn(),
  incrementWebhookFailures: jest.fn(),
  incrementErrors: jest.fn(),
}));
jest.mock('../../src/config/sentry', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('../../src/services/sql/paymentFailureSqlService', () => ({
  insertPaymentFailure: jest.fn().mockResolvedValue(undefined),
}));

const metrics = require('../../src/monitoring/metrics');
const { captureMessage } = require('../../src/config/sentry');
const paymentFailureSql = require('../../src/services/sql/paymentFailureSqlService');
const { trackPaymentFailure, trackWebhookFailure } = require('../../src/monitoring/track');

describe('track', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('trackPaymentFailure increments metrics and logs', () => {
    trackPaymentFailure('payment_not_completed', {
      requestId: 'req-1',
      stripeSessionId: 'cs_test',
    });

    expect(metrics.incrementPaymentFailures).toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalled();
    expect(paymentFailureSql.insertPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'payment_not_completed',
        correlationId: 'req-1',
        stripeSessionId: 'cs_test',
      })
    );
  });

  test('trackWebhookFailure increments webhook failure metric', () => {
    trackWebhookFailure('invalid_signature', { requestId: 'req-2' });

    expect(metrics.incrementWebhookFailures).toHaveBeenCalledWith('invalid_signature');
  });
});
