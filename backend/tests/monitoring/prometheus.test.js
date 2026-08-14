const client = require('prom-client');
const { getMetrics, recordRequest } = require('../../src/monitoring/prometheus');

describe('prometheus', () => {
  test('getMetrics returns prometheus text format', async () => {
    recordRequest('GET', '/api/cars', 200, 12, '/api/cars');
    const metrics = await getMetrics();

    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_requests_total');
  });
});
