const {
  assertTransition,
  canTransition,
  ACTIVE_HOLD_STATUSES,
  TRANSITIONS,
} = require('../../src/domain/reservationStatus');

describe('reservationStatus domain', () => {
  test('active holds are payment funnel statuses', () => {
    expect(ACTIVE_HOLD_STATUSES).toEqual(['pending_payment', 'processing_payment']);
  });

  test('allows payment funnel transitions', () => {
    expect(canTransition('pending_payment', 'processing_payment')).toBe(true);
    expect(canTransition('processing_payment', 'paid')).toBe(true);
    expect(canTransition('paid', 'confirmed')).toBe(true);
    expect(canTransition(null, 'pending_payment')).toBe(true);
    expect(canTransition(null, 'confirmed')).toBe(true);
  });

  test('rejects invalid transitions', () => {
    expect(() => assertTransition('confirmed', 'paid')).toThrow(/Invalid reservation status/);
    expect(canTransition('completed', 'returned')).toBe(false);
  });

  test('ops path from confirmed', () => {
    expect(TRANSITIONS.confirmed).toEqual(
      expect.arrayContaining(['car_prepared', 'cancelled', 'no_show'])
    );
  });
});
