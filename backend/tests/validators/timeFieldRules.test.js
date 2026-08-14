const { bodyTimeRule, queryTimeRule, sanitizeTimeValue } = require('../../src/validators/timeFieldRules');
const { runValidationRules } = require('../helpers/validatorTestUtils');

describe('timeFieldRules', () => {
  test('sanitizeTimeValue normalizes single-digit hour', () => {
    expect(sanitizeTimeValue('9:00')).toBe('09:00');
  });

  test('bodyTimeRule accepts valid time', async () => {
    const result = await runValidationRules([bodyTimeRule('pickupTime')], {
      body: { pickupTime: '10:00' },
    });

    expect(result.isEmpty()).toBe(true);
  });

  test('bodyTimeRule rejects invalid time format', async () => {
    const result = await runValidationRules(
      [bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' })],
      { body: { pickupTime: 'invalid' } }
    );

    expect(result.array()[0].msg).toBe('Pickup time must be in HH:MM format.');
  });

  test('queryTimeRule requires time when configured', async () => {
    const result = await runValidationRules(
      [queryTimeRule('pickupTime', { required: true, emptyMessage: 'Time is required.' })],
      { query: {} }
    );

    expect(result.array()[0].msg).toBe('Time is required.');
  });
});
