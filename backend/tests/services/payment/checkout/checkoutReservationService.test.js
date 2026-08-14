jest.mock('../../../../src/services/reservationService', () => ({
  findActiveReservationBySession: jest.fn(),
  attachCarNameToReservation: jest.fn(),
  extendReservationHold: jest.fn(),
  createPendingReservation: jest.fn(),
}));
jest.mock('../../../../src/services/paymentService', () => ({
  normalizeContactDetails: jest.fn((data) => data),
}));

const {
  findActiveReservationBySession,
  createPendingReservation,
} = require('../../../../src/services/reservationService');
const { resolveCheckoutReservation } = require('../../../../src/services/payment/checkout/checkoutReservationService');

describe('resolveCheckoutReservation', () => {
  const car = { id: 1, name: 'Yaris' };
  const formData = {
    pickupTime: '10:00',
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    fullName: 'Jane',
    email: 'jane@example.com',
  };
  const startDate = new Date('2026-08-01T07:00:00.000Z');
  const endDate = new Date('2026-08-05T07:00:00.000Z');
  const pricing = { rentalDays: 4, totalPrice: 180, deliveryPrice: 0, returnPrice: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
    findActiveReservationBySession.mockResolvedValue(null);
    createPendingReservation.mockResolvedValue({
      reservation: { id: '99' },
      overlappingReservation: false,
      bookedOverlap: false,
    });
  });

  test('creates a new reservation when none exists', async () => {
    const result = await resolveCheckoutReservation({
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      car,
      formData,
      startDate,
      endDate,
      pricing,
    });

    expect(result.ok).toBe(true);
    expect(result.createdReservationThisStep).toBe(true);
  });

  test('returns conflict when booked overlap exists', async () => {
    createPendingReservation.mockResolvedValue({
      reservation: null,
      overlappingReservation: false,
      bookedOverlap: true,
    });

    const result = await resolveCheckoutReservation({
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      car,
      formData,
      startDate,
      endDate,
      pricing,
    });

    expect(result.ok).toBe(false);
    expect(result.response.message).toContain('booked');
  });
});
