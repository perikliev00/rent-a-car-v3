const { validateBookingDates, isWithinRentalLimits } = require('../../src/utils/bookingValidation');
const { MAX_RENTAL_DAYS } = require('../../src/utils/date/rentalLimits');
const { listChargeDates } = require('../../src/utils/pricing/seasonalWeekendAdjustments');

const fixedNow = new Date('2026-06-27T12:00:00.000Z');

describe('rental duration limits', () => {
  test('accepts a normal rental and the maximum charged length', () => {
    const normal = validateBookingDates({
      pickupDate: '2026-07-01',
      returnDate: '2026-07-05',
      pickupTime: '10:00',
      returnTime: '10:00',
      now: fixedNow,
    });
    expect(normal.isValid).toBe(true);

    const start = new Date('2026-07-01T10:00:00.000Z');
    const maxEnd = new Date(start.getTime() + MAX_RENTAL_DAYS * 24 * 60 * 60 * 1000);
    expect(isWithinRentalLimits(start, maxEnd, fixedNow)).toBe(true);
    expect(listChargeDates(start, MAX_RENTAL_DAYS)).toHaveLength(MAX_RENTAL_DAYS);
  });

  test('rejects one day past the maximum before building charge dates', () => {
    const start = new Date('2026-07-01T10:00:00.000Z');
    const overEnd = new Date(start.getTime() + (MAX_RENTAL_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isWithinRentalLimits(start, overEnd, fixedNow)).toBe(false);
    expect(() => listChargeDates(start, MAX_RENTAL_DAYS + 1)).toThrow(/cannot exceed/);
    expect(() => listChargeDates(start, 2912077)).toThrow(/cannot exceed/);
  });

  test('rejects an unbounded calendar span and still allows a short rental years ahead', () => {
    const far = validateBookingDates({
      pickupDate: '2027-01-01',
      returnDate: '9999-12-31',
      pickupTime: '10:00',
      returnTime: '10:00',
      now: fixedNow,
    });
    expect(far.isValid).toBe(false);
    expect(far.rentalDays).toBeNull();
    expect(far.errors.join(' ')).toMatch(/cannot exceed/);

    const yearsAhead = validateBookingDates({
      pickupDate: '2031-06-01',
      returnDate: '2031-06-04',
      pickupTime: '10:00',
      returnTime: '10:00',
      now: fixedNow,
    });
    expect(yearsAhead.isValid).toBe(true);
    expect(yearsAhead.rentalDays).toBe(3);
  });
});
