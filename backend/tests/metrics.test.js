// Require the '../src/monitoring/metrics' module as metrics.
const metrics = require('../src/monitoring/metrics');

// Declare a test suite grouping related cases.
describe('monitoring metrics', () => {
  // Define a single test case and its expectations.
  test('records request stats and uptime', () => {
    // Call metrics.recordRequest to perform this step.
    metrics.recordRequest('GET', '/cars', 200, 42.5);
    // Call metrics.recordRequest to perform this step.
    metrics.recordRequest('POST', '/checkout', 500, 120);

    // Create the snapshot constant.
    const snapshot = metrics.getSnapshot();

    // Assert that the value matches the intended expectation.
    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
    // Assert that the value matches the intended expectation.
    expect(snapshot.requests.total).toBeGreaterThanOrEqual(2);
    // Assert that the value matches the intended expectation.
    expect(snapshot.requests.byStatus['200']).toBeGreaterThanOrEqual(1);
    // Assert that the value matches the intended expectation.
    expect(snapshot.requests.byStatus['500']).toBeGreaterThanOrEqual(1);
    // Assert that the value matches the intended expectation.
    expect(snapshot.requests.byMethod.GET).toBeGreaterThanOrEqual(1);
    // Assert that the value matches the intended expectation.
    expect(snapshot.requests.avgDurationMs).toBeGreaterThan(0);
  });

  // Define a single test case and its expectations.
  test('tracks payment and webhook failure counters', () => {
    // Create the before constant.
    const before = metrics.getSnapshot();

    // Call metrics.incrementPaymentFailures to perform this step.
    metrics.incrementPaymentFailures();
    // Call metrics.incrementWebhookFailures to perform this step.
    metrics.incrementWebhookFailures('signature_verification_failed');

    // Create the after constant.
    const after = metrics.getSnapshot();

    // Assert that the value matches the intended expectation.
    expect(after.paymentFailures).toBe(before.paymentFailures + 1);
    // Assert that the value matches the intended expectation.
    expect(after.webhookFailures).toBe(before.webhookFailures + 1);
  });
});
