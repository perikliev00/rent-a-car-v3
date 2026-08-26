const {
  assertTransition,
  canTransition,
  ACTIVE_HOLD_STATUSES,
  ADMIN_OPS_STATUSES,
  TRANSITIONS,
  isOrderRequiredForClaim,
  ORDER_OPTIONAL_FOR_CLAIM_STATUSES,
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

  test('ops path from confirmed includes refund', () => {
    expect(TRANSITIONS.confirmed).toEqual(
      expect.arrayContaining(['car_prepared', 'cancelled', 'no_show', 'refunded'])
    );
  });

  test('allows confirmed and car_prepared to refunded', () => {
    expect(canTransition('confirmed', 'refunded')).toBe(true);
    expect(canTransition('car_prepared', 'refunded')).toBe(true);
    expect(canTransition('picked_up', 'refunded')).toBe(false);
    expect(canTransition('cancelled', 'refunded')).toBe(false);
  });

  test('refunded is not an admin ops status', () => {
    expect(ADMIN_OPS_STATUSES).not.toContain('refunded');
  });

  test('paid and confirmed lifecycle statuses require an order during claim', () => {
    expect(isOrderRequiredForClaim('paid')).toBe(true);
    expect(isOrderRequiredForClaim('confirmed')).toBe(true);
    expect(isOrderRequiredForClaim('manual_review')).toBe(true);
    expect(isOrderRequiredForClaim('refunded')).toBe(true);
  });

  test('holds and pre-payment cancellations may have no order', () => {
    expect(ORDER_OPTIONAL_FOR_CLAIM_STATUSES).toEqual(
      expect.arrayContaining(['pending_payment', 'processing_payment', 'expired', 'cancelled', 'no_show'])
    );
    expect(isOrderRequiredForClaim('pending_payment')).toBe(false);
    expect(isOrderRequiredForClaim('cancelled')).toBe(false);
  });
});
