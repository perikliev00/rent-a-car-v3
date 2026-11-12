// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertTransition,
  // Contribute this line to the enclosing declaration or statement.
  canTransition,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_HOLD_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_OPS_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  TRANSITIONS,
// Continue the surrounding logic with this statement.
} = require('../../src/domain/reservationStatus');

// Declare a test suite grouping related cases.
describe('reservationStatus domain', () => {
  // Define a single test case and its expectations.
  test('active holds are payment funnel statuses', () => {
    // Assert that the value matches the intended expectation.
    expect(ACTIVE_HOLD_STATUSES).toEqual(['pending_payment', 'processing_payment']);
  });

  // Define a single test case and its expectations.
  test('allows payment funnel transitions', () => {
    // Assert that the value matches the intended expectation.
    expect(canTransition('pending_payment', 'processing_payment')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition('processing_payment', 'paid')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition('paid', 'confirmed')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition(null, 'pending_payment')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition(null, 'confirmed')).toBe(true);
  });

  // Define a single test case and its expectations.
  test('rejects invalid transitions', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('confirmed', 'paid')).toThrow(/Invalid reservation status/);
    // Assert that the value matches the intended expectation.
    expect(canTransition('completed', 'returned')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('ops path from confirmed includes refund', () => {
    // Assert that the value matches the intended expectation.
    expect(TRANSITIONS.confirmed).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['car_prepared', 'cancelled', 'no_show', 'refunded'])
    );
  });

  // Define a single test case and its expectations.
  test('allows confirmed and car_prepared to refunded', () => {
    // Assert that the value matches the intended expectation.
    expect(canTransition('confirmed', 'refunded')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition('car_prepared', 'refunded')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canTransition('picked_up', 'refunded')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(canTransition('cancelled', 'refunded')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('refunded is not an admin ops status', () => {
    // Assert that the value matches the intended expectation.
    expect(ADMIN_OPS_STATUSES).not.toContain('refunded');
  });
});
