const metrics = require('../src/monitoring/metrics');

describe('monitoring metrics', () => {
  test('records request stats and uptime', () => {
    metrics.recordRequest('GET', '/cars', 200, 42.5);
    metrics.recordRequest('POST', '/checkout', 500, 120);

    const snapshot = metrics.getSnapshot();

    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.requests.total).toBeGreaterThanOrEqual(2);
    expect(snapshot.requests.byStatus['200']).toBeGreaterThanOrEqual(1);
    expect(snapshot.requests.byStatus['500']).toBeGreaterThanOrEqual(1);
    expect(snapshot.requests.byMethod.GET).toBeGreaterThanOrEqual(1);
    expect(snapshot.requests.avgDurationMs).toBeGreaterThan(0);
  });

  test('tracks payment and webhook failure counters', () => {
    const before = metrics.getSnapshot();

    metrics.incrementPaymentFailures();
    metrics.incrementWebhookFailures('signature_verification_failed');

    const after = metrics.getSnapshot();

    expect(after.paymentFailures).toBe(before.paymentFailures + 1);
    expect(after.webhookFailures).toBe(before.webhookFailures + 1);
  });
});
