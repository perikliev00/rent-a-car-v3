const { toHHMM } = require('../../src/utils/date/normalizeTime');
const { parseStrictDateTimeInput } = require('../../src/utils/date/strictDateParts');
const { formatDateForDisplay } = require('../../src/utils/date/formatDate');
const { computeRentalDays, computeRentalDaysSafe } = require('../../src/utils/date/calculateRentalDays');
const { toUtc } = require('../../src/utils/toUtc');
const { validateBookingDates } = require('../../src/utils/date/parseBookingDateTime');

describe('normalizeTime.toHHMM', () => {
  test.each([
    ['9:00', '09:00'],
    ['09:00', '09:00'],
    ['23:59', '23:59'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(toHHMM(input)).toBe(expected);
  });

  test.each([['invalid'], [''], ['1:2:3']])('returns null for %s', (input) => {
    expect(toHHMM(input)).toBeNull();
  });
});

describe('strictDateParts.parseStrictDateTimeInput', () => {
  test('parses valid ISO date and time', () => {
    const result = parseStrictDateTimeInput('2026-07-10', '10:00');
    expect(result).toEqual(
      expect.objectContaining({ year: 2026, month: 7, day: 10, hour: 10, minute: 0 })
    );
  });

  test('returns null for invalid calendar date', () => {
    expect(parseStrictDateTimeInput('2026-02-31', '10:00')).toBeNull();
  });
});

describe('formatDate.formatDateForDisplay', () => {
  test('formats date string for display', () => {
    expect(formatDateForDisplay('2026-07-10')).toMatch(/10 Jul 2026/);
  });

  test('returns empty string for falsy input', () => {
    expect(formatDateForDisplay('')).toBe('');
  });
});

describe('calculateRentalDays', () => {
  test('computes inclusive rental days', () => {
    const start = new Date('2026-07-10T10:00:00Z');
    const end = new Date('2026-07-12T10:00:00Z');
    expect(computeRentalDays(start, end)).toBe(2);
  });

  test('returns at least one day for same-day rentals', () => {
    const date = new Date('2026-07-10T10:00:00Z');
    expect(computeRentalDays(date, new Date(date.getTime() + 3600000))).toBe(1);
  });

  test('computeRentalDaysSafe returns 0 for invalid input', () => {
    expect(computeRentalDaysSafe(null, null)).toBe(0);
  });
});

describe('toUtc', () => {
  test('converts Sofia local parts to UTC date', () => {
    const result = toUtc('2026-07-10', '10:00');
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });
});

describe('parseBookingDateTime.validateBookingDates', () => {
  test('rejects invalid date format', () => {
    const result = validateBookingDates({
      pickupDate: 'invalid',
      returnDate: '2026-12-01',
      now: new Date('2026-01-01T00:00:00Z'),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Invalid date format.');
  });
});
