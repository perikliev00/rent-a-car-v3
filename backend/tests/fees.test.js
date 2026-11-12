// Destructure object properties into local variables.
const { feeFor } = require('../src/utils/fees');

// Declare a test suite grouping related cases.
describe('feeFor', () => {
  // Define a single test case and its expectations.
  test('re-exports location fees (known location and unknown → 0)', () => {
    // Assert that the value matches the intended expectation.
    expect(feeFor('office')).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(feeFor('unknown-city')).toBe(0);
  });
});
