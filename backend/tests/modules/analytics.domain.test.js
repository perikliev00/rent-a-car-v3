// Destructure object properties into local variables.
const { periodDayCount, assertValidRange } = require('../../src/modules/analytics/analytics.service');

// Declare a test suite grouping related cases.
describe('analytics.domain helpers via service', () => {
  // Define a single test case and its expectations.
  test('periodDayCount is inclusive', () => {
    // Assert that the value matches the intended expectation.
    expect(periodDayCount('2026-07-01', '2026-07-01')).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(periodDayCount('2026-07-01', '2026-07-31')).toBe(31);
  });

  // Define a single test case and its expectations.
  test('assertValidRange rejects inverted range', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertValidRange('2026-08-01', '2026-07-01')).toThrow(/Invalid date range/);
  });
});
