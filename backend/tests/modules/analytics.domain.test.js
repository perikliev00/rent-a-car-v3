const { periodDayCount, assertValidRange } = require('../../src/modules/analytics/analytics.service');

describe('analytics.domain helpers via service', () => {
  test('periodDayCount is inclusive', () => {
    expect(periodDayCount('2026-07-01', '2026-07-01')).toBe(1);
    expect(periodDayCount('2026-07-01', '2026-07-31')).toBe(31);
  });

  test('assertValidRange rejects inverted range', () => {
    expect(() => assertValidRange('2026-08-01', '2026-07-01')).toThrow(/Invalid date range/);
  });
});
