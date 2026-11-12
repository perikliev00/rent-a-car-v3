const { feeFor } = require('../src/utils/fees');

describe('feeFor', () => {
  test('re-exports location fees (known location and unknown → 0)', () => {
    expect(feeFor('office')).toBe(0);
    expect(feeFor('unknown-city')).toBe(0);
  });
});
