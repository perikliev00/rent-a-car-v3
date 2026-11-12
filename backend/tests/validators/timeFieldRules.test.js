// Destructure object properties into local variables.
const { bodyTimeRule, queryTimeRule, sanitizeTimeValue } = require('../../src/validators/timeFieldRules');
// Destructure object properties into local variables.
const { runValidationRules } = require('../helpers/validatorTestUtils');

// Declare a test suite grouping related cases.
describe('timeFieldRules', () => {
  // Define a single test case and its expectations.
  test('sanitizeTimeValue normalizes single-digit hour', () => {
    // Assert that the value matches the intended expectation.
    expect(sanitizeTimeValue('9:00')).toBe('09:00');
  });

  // Define a single test case and its expectations.
  test('bodyTimeRule accepts valid time', async () => {
    // Create the result constant.
    const result = await runValidationRules([bodyTimeRule('pickupTime')], {
      // Provide the body field value.
      body: { pickupTime: '10:00' },
    });

    // Assert that the value matches the intended expectation.
    expect(result.isEmpty()).toBe(true);
  });

  // Define a single test case and its expectations.
  test('bodyTimeRule rejects invalid time format', async () => {
    // Create the result constant.
    const result = await runValidationRules(
      // Continue the surrounding logic with this statement.
      [bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' })],
      // Contribute this line to the enclosing declaration or statement.
      { body: { pickupTime: 'invalid' } }
    );

    // Assert that the value matches the intended expectation.
    expect(result.array()[0].msg).toBe('Pickup time must be in HH:MM format.');
  });

  // Define a single test case and its expectations.
  test('queryTimeRule requires time when configured', async () => {
    // Create the result constant.
    const result = await runValidationRules(
      // Continue the surrounding logic with this statement.
      [queryTimeRule('pickupTime', { required: true, emptyMessage: 'Time is required.' })],
      // Contribute this line to the enclosing declaration or statement.
      { query: {} }
    );

    // Assert that the value matches the intended expectation.
    expect(result.array()[0].msg).toBe('Time is required.');
  });
});
