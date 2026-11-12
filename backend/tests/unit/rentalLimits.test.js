// Destructure object properties into local variables.
const { validateBookingDates, isWithinRentalLimits } = require('../../src/utils/bookingValidation');
// Destructure object properties into local variables.
const { MAX_RENTAL_DAYS } = require('../../src/utils/date/rentalLimits');
// Destructure object properties into local variables.
const { listChargeDates } = require('../../src/utils/pricing/seasonalWeekendAdjustments');

// Create the fixed now constant.
const fixedNow = new Date('2026-06-27T12:00:00.000Z');

// Declare a test suite grouping related cases.
describe('rental duration limits', () => {
  // Define a single test case and its expectations.
  test('accepts a normal rental and the maximum charged length', () => {
    // Create the normal constant.
    const normal = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-01',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the now field value.
      now: fixedNow,
    });
    // Assert that the value matches the intended expectation.
    expect(normal.isValid).toBe(true);

    // Create the start constant.
    const start = new Date('2026-07-01T10:00:00.000Z');
    // Create the max end constant.
    const maxEnd = new Date(start.getTime() + MAX_RENTAL_DAYS * 24 * 60 * 60 * 1000);
    // Assert that the value matches the intended expectation.
    expect(isWithinRentalLimits(start, maxEnd, fixedNow)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(listChargeDates(start, MAX_RENTAL_DAYS)).toHaveLength(MAX_RENTAL_DAYS);
  });

  // Define a single test case and its expectations.
  test('rejects one day past the maximum before building charge dates', () => {
    // Create the start constant.
    const start = new Date('2026-07-01T10:00:00.000Z');
    // Create the over end constant.
    const overEnd = new Date(start.getTime() + (MAX_RENTAL_DAYS + 1) * 24 * 60 * 60 * 1000);
    // Assert that the value matches the intended expectation.
    expect(isWithinRentalLimits(start, overEnd, fixedNow)).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(() => listChargeDates(start, MAX_RENTAL_DAYS + 1)).toThrow(/cannot exceed/);
    // Assert that the value matches the intended expectation.
    expect(() => listChargeDates(start, 2912077)).toThrow(/cannot exceed/);
  });

  // Define a single test case and its expectations.
  test('rejects an unbounded calendar span and still allows a short rental years ahead', () => {
    // Create the far constant.
    const far = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2027-01-01',
      // Provide the return date field value.
      returnDate: '9999-12-31',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the now field value.
      now: fixedNow,
    });
    // Assert that the value matches the intended expectation.
    expect(far.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(far.rentalDays).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(far.errors.join(' ')).toMatch(/cannot exceed/);

    // Create the years ahead constant.
    const yearsAhead = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2031-06-01',
      // Provide the return date field value.
      returnDate: '2031-06-04',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the now field value.
      now: fixedNow,
    });
    // Assert that the value matches the intended expectation.
    expect(yearsAhead.isValid).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(yearsAhead.rentalDays).toBe(3);
  });
});
