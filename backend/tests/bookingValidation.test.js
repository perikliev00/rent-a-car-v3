// Destructure object properties into local variables.
const { validateBookingDates } = require('../src/utils/bookingValidation');
// Destructure object properties into local variables.
const { getSofiaIsoDateString } = require('../src/utils/date/timezone');

// Create the fixed now constant.
const fixedNow = new Date('2026-06-27T12:00:00');

// Declare a test suite grouping related cases.
describe('validateBookingDates', () => {
  // Define a single test case and its expectations.
  test('accepts valid future booking window', () => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-01',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Provide the now field value.
      now: fixedNow,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toEqual([]);
    // Assert that the value matches the intended expectation.
    expect(result.rentalDays).toBeGreaterThanOrEqual(1);
  });

  // Define a single test case and its expectations.
  test('rejects return date before pickup date', () => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-05',
      // Provide the return date field value.
      returnDate: '2026-07-03',
      // Provide the now field value.
      now: fixedNow,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toContain('Return date must be after pick-up date.');
  });

  // Define a single test case and its expectations.
  test('rejects invalid date format', () => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: 'not-a-date',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the now field value.
      now: fixedNow,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toContain('Invalid date format.');
  });

  // Define a single test case and its expectations.
  test('rejects impossible calendar dates', () => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-02-31',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Provide the now field value.
      now: fixedNow,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toContain('Invalid date format.');
  });

  // Define a single test case and its expectations.
  test('rejects pickup in the past', () => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-06-20',
      // Provide the return date field value.
      returnDate: '2026-06-25',
      // Provide the now field value.
      now: fixedNow,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toContain('Pick-up and return dates cannot be in the past.');
  });
});

// Declare a test suite grouping related cases.
describe('validateBookingDates timezone independence', () => {
  // Define a single test case and its expectations.
  test('Test 1: treats current Sofia calendar day as today on a UTC server instant', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T10:00:00.000Z');
    // Create the today iso constant.
    const todayIso = getSofiaIsoDateString(now);

    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: todayIso,
      // Provide the return date field value.
      returnDate: '2026-07-16',
      // Provide the pickup time field value.
      pickupTime: '18:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toEqual([]);
  });

  // Define a single test case and its expectations.
  test('Test 2: accepts booking for the current Sofia day regardless of server-local interpretation', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T20:55:00.000Z');

    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-15',
      // Provide the return date field value.
      returnDate: '2026-07-16',
      // Provide the pickup time field value.
      pickupTime: '23:58',
      // Provide the return time field value.
      returnTime: '23:59',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(true);
  });

  // Define a single test case and its expectations.
  test('Test 3: does not treat the next Sofia day as today before local midnight', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T20:55:00.000Z');

    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-16',
      // Provide the return date field value.
      returnDate: '2026-07-17',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.errors).not.toContain('Pick-up and return dates cannot be in the past.');
  });

  // Define a single test case and its expectations.
  test('Test 4: rejects yesterday in Sofia after local midnight even when UTC date is still previous day', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T21:05:00.000Z');

    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-15',
      // Provide the return date field value.
      returnDate: '2026-07-16',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.errors).toContain('Pick-up and return dates cannot be in the past.');
  });

  // Define a single test case and its expectations.
  test('Test 4b: accepts the new Sofia day immediately after local midnight', () => {
    // Create the now constant.
    const now = new Date('2026-07-15T21:05:00.000Z');

    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: '2026-07-16',
      // Provide the return date field value.
      returnDate: '2026-07-17',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Assert that the value matches the intended expectation.
    expect(result.isValid).toBe(true);
  });

  // Define a single test case and its expectations.
  test('Test 5: keeps validation correct across winter and summer DST boundaries', () => {
    // Create the winter now constant.
    const winterNow = new Date('2026-01-15T22:30:00.000Z');
    // Create the summer now constant.
    const summerNow = new Date('2026-07-15T21:30:00.000Z');

    // Assert that the value matches the intended expectation.
    expect(
      // Call validateBookingDates to perform this step.
      validateBookingDates({
        // Provide the pickup date field value.
        pickupDate: '2026-01-15',
        // Provide the return date field value.
        returnDate: '2026-01-16',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the now field value.
        now: winterNow,
      // Continue the surrounding logic with this statement.
      }).isValid
    // Continue the surrounding logic with this statement.
    ).toBe(false);

    // Assert that the value matches the intended expectation.
    expect(
      // Call validateBookingDates to perform this step.
      validateBookingDates({
        // Provide the pickup date field value.
        pickupDate: '2026-01-16',
        // Provide the return date field value.
        returnDate: '2026-01-17',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the now field value.
        now: winterNow,
      // Continue the surrounding logic with this statement.
      }).isValid
    // Continue the surrounding logic with this statement.
    ).toBe(true);

    // Assert that the value matches the intended expectation.
    expect(
      // Call validateBookingDates to perform this step.
      validateBookingDates({
        // Provide the pickup date field value.
        pickupDate: '2026-07-15',
        // Provide the return date field value.
        returnDate: '2026-07-16',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the now field value.
        now: summerNow,
      // Continue the surrounding logic with this statement.
      }).isValid
    // Continue the surrounding logic with this statement.
    ).toBe(false);

    // Assert that the value matches the intended expectation.
    expect(
      // Call validateBookingDates to perform this step.
      validateBookingDates({
        // Provide the pickup date field value.
        pickupDate: '2026-07-16',
        // Provide the return date field value.
        returnDate: '2026-07-17',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '18:00',
        // Provide the now field value.
        now: summerNow,
      // Continue the surrounding logic with this statement.
      }).isValid
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });
});
