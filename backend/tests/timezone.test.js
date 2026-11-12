// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseSofiaDate,
  // Contribute this line to the enclosing declaration or statement.
  getSofiaIsoDateString,
  // Contribute this line to the enclosing declaration or statement.
  getTomorrowSofiaIsoDate,
  // Contribute this line to the enclosing declaration or statement.
  getTodayInSofia,
// Continue the surrounding logic with this statement.
} = require('../src/utils/date/timezone');

// Declare a test suite grouping related cases.
describe('parseSofiaDate', () => {
  // Declare a test suite grouping related cases.
  describe('valid inputs', () => {
    // Call test.each to perform this step.
    test.each([
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15', '14:30'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15 14:30', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15T14:30', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2028-02-29', '12:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2028-02-29 12:00', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2028-02-29T12:00', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-02-03', '9:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-02-03', '9:30'],
    // Continue the surrounding logic with this statement.
    ])('accepts %s with time %s', (dateString, timeString) => {
      // Create the result constant.
      const result = parseSofiaDate(dateString, timeString);
      // Assert that the value matches the intended expectation.
      expect(result).toBeInstanceOf(Date);
      // Assert that the value matches the intended expectation.
      expect(Number.isNaN(result.getTime())).toBe(false);
    });
  });

  // Declare a test suite grouping related cases.
  describe('invalid calendar values', () => {
    // Call test.each to perform this step.
    test.each([
      // Contribute this line to the enclosing declaration or statement.
      ['2026-13-01', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-00-10', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-02-31', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2025-04-31', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15', '24:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15', '12:60'],
      // Contribute this line to the enclosing declaration or statement.
      ['abcd-ef-gh', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-99-99', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15 24:00', '00:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-06-15 12:60', '00:00'],
    // Continue the surrounding logic with this statement.
    ])('rejects %s with time %s', (dateString, timeString) => {
      // Assert that the value matches the intended expectation.
      expect(parseSofiaDate(dateString, timeString)).toBeNull();
    });
  });

  // Declare a test suite grouping related cases.
  describe('invalid formats', () => {
    // Call test.each to perform this step.
    test.each([
      // Contribute this line to the enclosing declaration or statement.
      ['2026-2-3', '10:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026/02/03', '10:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-02-03abc', '10:00'],
      // Contribute this line to the enclosing declaration or statement.
      ['2026-02-03', '09:0'],
      // Contribute this line to the enclosing declaration or statement.
      ['', '10:00'],
      // Contribute this line to the enclosing declaration or statement.
      [null, '10:00'],
    // Continue the surrounding logic with this statement.
    ])('rejects non-strict format %s with time %s', (dateString, timeString) => {
      // Assert that the value matches the intended expectation.
      expect(parseSofiaDate(dateString, timeString)).toBeNull();
    });
  });

  // Define a single test case and its expectations.
  test('returns null for empty date input', () => {
    // Assert that the value matches the intended expectation.
    expect(parseSofiaDate()).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(parseSofiaDate('')).toBeNull();
  });
});

// Declare a test suite grouping related cases.
describe('Sofia calendar date helpers', () => {
  // Define a single test case and its expectations.
  test('Test 1: resolves today from Europe/Sofia when server instant is UTC', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T10:00:00.000Z');

    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(now)).toBe('2026-07-15');
    // Assert that the value matches the intended expectation.
    expect(getTodayInSofia(now).toISOString()).toBe(parseSofiaDate('2026-07-15', '00:00').toISOString());
  });

  // Define a single test case and its expectations.
  test('Test 3: does not advance to the next Sofia day before local midnight', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T20:55:00.000Z');

    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(now)).toBe('2026-07-15');
    // Assert that the value matches the intended expectation.
    expect(getTomorrowSofiaIsoDate(now)).toBe('2026-07-16');
  });

  // Define a single test case and its expectations.
  test('Test 4: advances Sofia today immediately after local midnight', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T21:05:00.000Z');

    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(now)).toBe('2026-07-16');
    // Assert that the value matches the intended expectation.
    expect(getTomorrowSofiaIsoDate(now)).toBe('2026-07-17');
  });

  // Define a single test case and its expectations.
  test('Test 5: handles DST transitions without hardcoded offsets', () => {
    // Create the winter after midnight constant.
    const winterAfterMidnight = new Date('2026-01-15T22:30:00.000Z');
    // Create the summer after midnight constant.
    const summerAfterMidnight = new Date('2026-07-15T21:30:00.000Z');

    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(winterAfterMidnight)).toBe('2026-01-16');
    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(summerAfterMidnight)).toBe('2026-07-16');
  });
});
