const {
  getSessionId,
  buildExistingReservationSummary,
  ACTIVE_RESERVATION_STATUSES,
} = require('../../src/utils/reservationHelpers');

describe('getSessionId', () => {
  test('prefers session._sid when present', () => {
    const req = { session: { _sid: 'custom-sid' }, sessionID: 'express-sid' };
    expect(getSessionId(req)).toBe('custom-sid');
  });

  test('falls back to sessionID', () => {
    const req = { session: {}, sessionID: 'express-sid' };
    expect(getSessionId(req)).toBe('express-sid');
  });

  test('returns sessionID when session is missing', () => {
    const req = { sessionID: 'only-express' };
    expect(getSessionId(req)).toBe('only-express');
  });
});

describe('buildExistingReservationSummary', () => {
  test('returns null for missing reservation', () => {
    expect(buildExistingReservationSummary(null)).toBeNull();
  });

  test('builds summary with formatted dates and price', () => {
    const summary = buildExistingReservationSummary({
      carId: { name: 'BMW X5' },
      pickupDate: new Date('2026-07-10'),
      returnDate: new Date('2026-07-12'),
      totalPrice: 120.5,
    });

    expect(summary).toEqual({
      carName: 'BMW X5',
      pickupDate: expect.any(String),
      returnDate: expect.any(String),
      totalPrice: '120.50',
    });
  });
});

describe('ACTIVE_RESERVATION_STATUSES', () => {
  test('includes pending and processing', () => {
    expect(ACTIVE_RESERVATION_STATUSES).toEqual(['pending_payment', 'processing_payment']);
  });
});
