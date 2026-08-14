const { feeFor, FEES } = require('../src/utils/fees');

describe('feeFor', () => {
  test('returns configured fee for known locations', () => {
    expect(feeFor('office')).toBe(0);
    expect(feeFor('burgas-airport')).toBe(50);
    expect(feeFor('sofia-airport')).toBe(120);
  });

  test('returns 0 for unknown locations', () => {
    expect(feeFor('unknown-city')).toBe(0);
    expect(feeFor(undefined)).toBe(0);
  });

  test('exports all supported location keys', () => {
    expect(Object.keys(FEES).length).toBeGreaterThan(5);
    expect(FEES).toHaveProperty('sunny-beach', 25);
  });
});
