// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isValidLocation,
  // Contribute this line to the enclosing declaration or statement.
  formatLocationName,
  // Contribute this line to the enclosing declaration or statement.
  getLocationOptions,
  // Contribute this line to the enclosing declaration or statement.
  feeFor,
// Continue the surrounding logic with this statement.
} = require('../../src/services/locationService');

// Declare a test suite grouping related cases.
describe('locationService', () => {
  // Define a single test case and its expectations.
  test('isValidLocation accepts known locations', () => {
    // Assert that the value matches the intended expectation.
    expect(isValidLocation('office')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isValidLocation('unknown')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('formatLocationName returns label for known location', () => {
    // Assert that the value matches the intended expectation.
    expect(formatLocationName('office')).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('getLocationOptions returns id/label pairs', () => {
    // Create the options constant.
    const options = getLocationOptions();
    // Assert that the value matches the intended expectation.
    expect(options[0]).toEqual(expect.objectContaining({ id: expect.any(String), label: expect.any(String) }));
  });

  // Define a single test case and its expectations.
  test('feeFor returns configured delivery fee', () => {
    // Assert that the value matches the intended expectation.
    expect(typeof feeFor('office')).toBe('number');
  });
});
