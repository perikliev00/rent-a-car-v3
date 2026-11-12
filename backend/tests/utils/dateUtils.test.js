// Destructure object properties into local variables.
const { toHHMM } = require('../../src/utils/date/normalizeTime');
// Destructure object properties into local variables.
const { parseStrictDateTimeInput } = require('../../src/utils/date/strictDateParts');
// Destructure object properties into local variables.
const { formatDateForDisplay } = require('../../src/utils/date/formatDate');
// Destructure object properties into local variables.
const { computeRentalDays, computeRentalDaysSafe } = require('../../src/utils/date/calculateRentalDays');
// Destructure object properties into local variables.
const { toUtc } = require('../../src/utils/toUtc');

// Declare a test suite grouping related cases.
describe('normalizeTime.toHHMM', () => {
  // Call test.each to perform this step.
  test.each([
    // Contribute this line to the enclosing declaration or statement.
    ['9:00', '09:00'],
    // Contribute this line to the enclosing declaration or statement.
    ['09:00', '09:00'],
    // Contribute this line to the enclosing declaration or statement.
    ['23:59', '23:59'],
  // Continue the surrounding logic with this statement.
  ])('normalizes %s to %s', (input, expected) => {
    // Assert that the value matches the intended expectation.
    expect(toHHMM(input)).toBe(expected);
  });

  // Call test.each to perform this step.
  test.each([['invalid'], [''], ['1:2:3']])('returns null for %s', (input) => {
    // Assert that the value matches the intended expectation.
    expect(toHHMM(input)).toBeNull();
  });
});

// Declare a test suite grouping related cases.
describe('strictDateParts.parseStrictDateTimeInput', () => {
  // Define a single test case and its expectations.
  test('parses valid ISO date and time', () => {
    // Create the result constant.
    const result = parseStrictDateTimeInput('2026-07-10', '10:00');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ year: 2026, month: 7, day: 10, hour: 10, minute: 0 })
    );
  });

  // Define a single test case and its expectations.
  test('returns null for invalid calendar date', () => {
    // Assert that the value matches the intended expectation.
    expect(parseStrictDateTimeInput('2026-02-31', '10:00')).toBeNull();
  });
});

// Declare a test suite grouping related cases.
describe('formatDate.formatDateForDisplay', () => {
  // Define a single test case and its expectations.
  test('formats date string for display', () => {
    // Assert that the value matches the intended expectation.
    expect(formatDateForDisplay('2026-07-10')).toMatch(/10 Jul 2026/);
  });

  // Define a single test case and its expectations.
  test('returns empty string for falsy input', () => {
    // Assert that the value matches the intended expectation.
    expect(formatDateForDisplay('')).toBe('');
  });
});

// Declare a test suite grouping related cases.
describe('calculateRentalDays', () => {
  // Define a single test case and its expectations.
  test('computes inclusive rental days', () => {
    // Create the start constant.
    const start = new Date('2026-07-10T10:00:00Z');
    // Create the end constant.
    const end = new Date('2026-07-12T10:00:00Z');
    // Assert that the value matches the intended expectation.
    expect(computeRentalDays(start, end)).toBe(2);
  });

  // Define a single test case and its expectations.
  test('returns at least one day for same-day rentals', () => {
    // Create the date constant.
    const date = new Date('2026-07-10T10:00:00Z');
    // Assert that the value matches the intended expectation.
    expect(computeRentalDays(date, new Date(date.getTime() + 3600000))).toBe(1);
  });

  // Define a single test case and its expectations.
  test('computeRentalDaysSafe returns 0 for invalid input', () => {
    // Assert that the value matches the intended expectation.
    expect(computeRentalDaysSafe(null, null)).toBe(0);
  });

  // Define a single test case and its expectations.
  test('throws for invalid dates', () => {
    // Assert that the value matches the intended expectation.
    expect(() => computeRentalDays(new Date('invalid'), new Date())).toThrow(
      // Supply the literal value used by the enclosing expression.
      'Invalid dates passed to computeRentalDays'
    );
  });
});

// Declare a test suite grouping related cases.
describe('toUtc', () => {
  // Define a single test case and its expectations.
  test('converts Sofia local parts to UTC date', () => {
    // Create the result constant.
    const result = toUtc('2026-07-10', '10:00');
    // Assert that the value matches the intended expectation.
    expect(result).toBeInstanceOf(Date);
    // Assert that the value matches the intended expectation.
    expect(Number.isNaN(result.getTime())).toBe(false);
  });
});
