// Call jest.mock to perform this step.
jest.mock('../../src/monitoring/metrics', () => ({
  // Provide the increment payment failures field value.
  incrementPaymentFailures: jest.fn(),
  // Provide the increment webhook failures field value.
  incrementWebhookFailures: jest.fn(),
  // Provide the increment errors field value.
  incrementErrors: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/config/sentry', () => ({
  // Provide the capture message field value.
  captureMessage: jest.fn(),
  // Provide the capture exception field value.
  captureException: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/paymentFailureSqlService', () => ({
  // Provide the insert payment failure field value.
  insertPaymentFailure: jest.fn().mockResolvedValue(undefined),
}));

// Require the '../../src/monitoring/metrics' module as metrics.
const metrics = require('../../src/monitoring/metrics');
// Destructure object properties into local variables.
const { captureMessage } = require('../../src/config/sentry');
// Require the '../../src/services/sql/paymentFailureSqlService' module as paymentFailureSql.
const paymentFailureSql = require('../../src/services/sql/paymentFailureSqlService');
// Destructure object properties into local variables.
const { trackPaymentFailure, trackWebhookFailure } = require('../../src/monitoring/track');

// Declare a test suite grouping related cases.
describe('track', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('trackPaymentFailure increments metrics and logs', () => {
    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure('payment_not_completed', {
      // Provide the request id field value.
      requestId: 'req-1',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_test',
    });

    // Assert that the value matches the intended expectation.
    expect(metrics.incrementPaymentFailures).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(captureMessage).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(paymentFailureSql.insertPaymentFailure).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reason field value.
        reason: 'payment_not_completed',
        // Provide the correlation id field value.
        correlationId: 'req-1',
        // Provide the stripe session id field value.
        stripeSessionId: 'cs_test',
      })
    );
  });

  // Define a single test case and its expectations.
  test('trackWebhookFailure increments webhook failure metric', () => {
    // Call trackWebhookFailure to perform this step.
    trackWebhookFailure('invalid_signature', { requestId: 'req-2' });

    // Assert that the value matches the intended expectation.
    expect(metrics.incrementWebhookFailures).toHaveBeenCalledWith('invalid_signature');
  });
});
