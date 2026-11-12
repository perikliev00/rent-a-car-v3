const { validateBookingDates } = require('../src/utils/bookingValidation');
const { getSofiaIsoDateString } = require('../src/utils/date/timezone');

const fixedNow = new Date('2026-06-27T12:00:00');

describe('validateBookingDates', () => {
  test('accepts valid future booking window', () => {
    const result = validateBookingDates({
      pickupDate: '2026-07-01',
      returnDate: '2026-07-05',
      pickupTime: '10:00',
      returnTime: '18:00',
      now: fixedNow,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rentalDays).toBeGreaterThanOrEqual(1);
  });

  test('rejects return date before pickup date', () => {
    const result = validateBookingDates({
      pickupDate: '2026-07-05',
      returnDate: '2026-07-03',
      now: fixedNow,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Return date must be after pick-up date.');
  });

  test('rejects invalid date format', () => {
    const result = validateBookingDates({
      pickupDate: 'not-a-date',
      returnDate: '2026-07-05',
      now: fixedNow,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid date format.');
  });

  test('rejects impossible calendar dates', () => {
    const result = validateBookingDates({
      pickupDate: '2026-02-31',
      returnDate: '2026-07-05',
      pickupTime: '10:00',
      returnTime: '18:00',
      now: fixedNow,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid date format.');
  });

  test('rejects pickup in the past', () => {
    const result = validateBookingDates({
      pickupDate: '2026-06-20',
      returnDate: '2026-06-25',
      now: fixedNow,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Pick-up and return dates cannot be in the past.');
  });
});

describe('validateBookingDates timezone independence', () => {
  test('Test 1: treats current Sofia calendar day as today on a UTC server instant', () => {
    const now = new Date('2026-07-15T10:00:00.000Z');
    const todayIso = getSofiaIsoDateString(now);

    const result = validateBookingDates({
      pickupDate: todayIso,
      returnDate: '2026-07-16',
      pickupTime: '18:00',
      returnTime: '18:00',
      now,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('Test 2: accepts booking for the current Sofia day regardless of server-local interpretation', () => {
    const now = new Date('2026-07-15T20:55:00.000Z');

    const result = validateBookingDates({
      pickupDate: '2026-07-15',
      returnDate: '2026-07-16',
      pickupTime: '23:58',
      returnTime: '23:59',
      now,
    });

    expect(result.isValid).toBe(true);
  });

  test('Test 3: does not treat the next Sofia day as today before local midnight', () => {
    const now = new Date('2026-07-15T20:55:00.000Z');

    const result = validateBookingDates({
      pickupDate: '2026-07-16',
      returnDate: '2026-07-17',
      pickupTime: '10:00',
      returnTime: '18:00',
      now,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).not.toContain('Pick-up and return dates cannot be in the past.');
  });

  test('Test 4: rejects yesterday in Sofia after local midnight even when UTC date is still previous day', () => {
    const now = new Date('2026-07-15T21:05:00.000Z');

    const result = validateBookingDates({
      pickupDate: '2026-07-15',
      returnDate: '2026-07-16',
      pickupTime: '10:00',
      returnTime: '18:00',
      now,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Pick-up and return dates cannot be in the past.');
  });

  test('Test 4b: accepts the new Sofia day immediately after local midnight', () => {
    const now = new Date('2026-07-15T21:05:00.000Z');

    const result = validateBookingDates({
      pickupDate: '2026-07-16',
      returnDate: '2026-07-17',
      pickupTime: '10:00',
      returnTime: '18:00',
      now,
    });

    expect(result.isValid).toBe(true);
  });

  test('Test 5: keeps validation correct across winter and summer DST boundaries', () => {
    const winterNow = new Date('2026-01-15T22:30:00.000Z');
    const summerNow = new Date('2026-07-15T21:30:00.000Z');

    expect(
      validateBookingDates({
        pickupDate: '2026-01-15',
        returnDate: '2026-01-16',
        pickupTime: '10:00',
        returnTime: '18:00',
        now: winterNow,
      }).isValid
    ).toBe(false);

    expect(
      validateBookingDates({
        pickupDate: '2026-01-16',
        returnDate: '2026-01-17',
        pickupTime: '10:00',
        returnTime: '18:00',
        now: winterNow,
      }).isValid
    ).toBe(true);

    expect(
      validateBookingDates({
        pickupDate: '2026-07-15',
        returnDate: '2026-07-16',
        pickupTime: '10:00',
        returnTime: '18:00',
        now: summerNow,
      }).isValid
    ).toBe(false);

    expect(
      validateBookingDates({
        pickupDate: '2026-07-16',
        returnDate: '2026-07-17',
        pickupTime: '10:00',
        returnTime: '18:00',
        now: summerNow,
      }).isValid
    ).toBe(true);
  });
});
