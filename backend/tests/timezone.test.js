const {
  parseSofiaDate,
  getSofiaIsoDateString,
  getTomorrowSofiaIsoDate,
  getTodayInSofia,
} = require('../src/utils/date/timezone');

describe('parseSofiaDate', () => {
  describe('valid inputs', () => {
    test.each([
      ['2026-06-15', '14:30'],
      ['2026-06-15 14:30', '00:00'],
      ['2026-06-15T14:30', '00:00'],
      ['2028-02-29', '12:00'],
      ['2028-02-29 12:00', '00:00'],
      ['2028-02-29T12:00', '00:00'],
      ['2026-02-03', '9:00'],
      ['2026-02-03', '9:30'],
    ])('accepts %s with time %s', (dateString, timeString) => {
      const result = parseSofiaDate(dateString, timeString);
      expect(result).toBeInstanceOf(Date);
      expect(Number.isNaN(result.getTime())).toBe(false);
    });
  });

  describe('invalid calendar values', () => {
    test.each([
      ['2026-13-01', '00:00'],
      ['2026-00-10', '00:00'],
      ['2026-02-31', '00:00'],
      ['2025-04-31', '00:00'],
      ['2026-06-15', '24:00'],
      ['2026-06-15', '12:60'],
      ['abcd-ef-gh', '00:00'],
      ['2026-99-99', '00:00'],
      ['2026-06-15 24:00', '00:00'],
      ['2026-06-15 12:60', '00:00'],
    ])('rejects %s with time %s', (dateString, timeString) => {
      expect(parseSofiaDate(dateString, timeString)).toBeNull();
    });
  });

  describe('invalid formats', () => {
    test.each([
      ['2026-2-3', '10:00'],
      ['2026/02/03', '10:00'],
      ['2026-02-03abc', '10:00'],
      ['2026-02-03', '09:0'],
      ['', '10:00'],
      [null, '10:00'],
    ])('rejects non-strict format %s with time %s', (dateString, timeString) => {
      expect(parseSofiaDate(dateString, timeString)).toBeNull();
    });
  });

  test('returns null for empty date input', () => {
    expect(parseSofiaDate()).toBeNull();
    expect(parseSofiaDate('')).toBeNull();
  });
});

describe('Sofia calendar date helpers', () => {
  test('Test 1: resolves today from Europe/Sofia when server instant is UTC', () => {
    const now = new Date('2026-07-15T10:00:00.000Z');

    expect(getSofiaIsoDateString(now)).toBe('2026-07-15');
    expect(getTodayInSofia(now).toISOString()).toBe(parseSofiaDate('2026-07-15', '00:00').toISOString());
  });

  test('Test 3: does not advance to the next Sofia day before local midnight', () => {
    const now = new Date('2026-07-15T20:55:00.000Z');

    expect(getSofiaIsoDateString(now)).toBe('2026-07-15');
    expect(getTomorrowSofiaIsoDate(now)).toBe('2026-07-16');
  });

  test('Test 4: advances Sofia today immediately after local midnight', () => {
    const now = new Date('2026-07-15T21:05:00.000Z');

    expect(getSofiaIsoDateString(now)).toBe('2026-07-16');
    expect(getTomorrowSofiaIsoDate(now)).toBe('2026-07-17');
  });

  test('Test 5: handles DST transitions without hardcoded offsets', () => {
    const winterAfterMidnight = new Date('2026-01-15T22:30:00.000Z');
    const summerAfterMidnight = new Date('2026-07-15T21:30:00.000Z');

    expect(getSofiaIsoDateString(winterAfterMidnight)).toBe('2026-01-16');
    expect(getSofiaIsoDateString(summerAfterMidnight)).toBe('2026-07-16');
  });
});
