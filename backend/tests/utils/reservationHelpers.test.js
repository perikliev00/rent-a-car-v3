// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getSessionId,
  // Contribute this line to the enclosing declaration or statement.
  buildExistingReservationSummary,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_RESERVATION_STATUSES,
// Continue the surrounding logic with this statement.
} = require('../../src/utils/reservationHelpers');

// Declare a test suite grouping related cases.
describe('getSessionId', () => {
  // Define a single test case and its expectations.
  test('prefers session._sid when present', () => {
    // Create the req constant.
    const req = { session: { _sid: 'custom-sid' }, sessionID: 'express-sid' };
    // Assert that the value matches the intended expectation.
    expect(getSessionId(req)).toBe('custom-sid');
  });

  // Define a single test case and its expectations.
  test('falls back to sessionID', () => {
    // Create the req constant.
    const req = { session: {}, sessionID: 'express-sid' };
    // Assert that the value matches the intended expectation.
    expect(getSessionId(req)).toBe('express-sid');
  });

  // Define a single test case and its expectations.
  test('returns sessionID when session is missing', () => {
    // Create the req constant.
    const req = { sessionID: 'only-express' };
    // Assert that the value matches the intended expectation.
    expect(getSessionId(req)).toBe('only-express');
  });
});

// Declare a test suite grouping related cases.
describe('buildExistingReservationSummary', () => {
  // Define a single test case and its expectations.
  test('returns null for missing reservation', () => {
    // Assert that the value matches the intended expectation.
    expect(buildExistingReservationSummary(null)).toBeNull();
  });

  // Define a single test case and its expectations.
  test('builds summary with formatted dates and price', () => {
    // Create the summary constant.
    const summary = buildExistingReservationSummary({
      // Provide the car id field value.
      carId: { name: 'BMW X5' },
      // Provide the pickup date field value.
      pickupDate: new Date('2026-07-10'),
      // Provide the return date field value.
      returnDate: new Date('2026-07-12'),
      // Provide the total price field value.
      totalPrice: 120.5,
    });

    // Assert that the value matches the intended expectation.
    expect(summary).toEqual({
      // Provide the car name field value.
      carName: 'BMW X5',
      // Provide the pickup date field value.
      pickupDate: expect.any(String),
      // Provide the return date field value.
      returnDate: expect.any(String),
      // Provide the total price field value.
      totalPrice: '120.50',
    });
  });
});

// Declare a test suite grouping related cases.
describe('ACTIVE_RESERVATION_STATUSES', () => {
  // Define a single test case and its expectations.
  test('includes pending and processing', () => {
    // Assert that the value matches the intended expectation.
    expect(ACTIVE_RESERVATION_STATUSES).toEqual(['pending_payment', 'processing_payment']);
  });
});
