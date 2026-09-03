jest.mock('../../../../src/services/reservationService', () => ({
  findActiveReservationBySession: jest.fn(),
  attachCarNameToReservation: jest.fn(async (reservation) => reservation),
  extendReservationHold: jest.fn(),
  createPendingReservation: jest.fn(),
  checkCarAvailabilityForRange: jest.fn(),
}));
jest.mock('../../../../src/services/paymentService', () => ({
  normalizeContactDetails: jest.fn((data) => data),
}));
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
}));

const {
  findActiveReservationBySession,
  createPendingReservation,
  checkCarAvailabilityForRange,
  extendReservationHold,
} = require('../../../../src/services/reservationService');
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
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
  const existingHold = {
    id: 'hold-1',
    carId: 1,
    pickupDate: startDate,
    returnDate: endDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findActiveReservationBySession.mockResolvedValue(null);
    createPendingReservation.mockResolvedValue({
      reservation: { id: '99' },
      overlappingReservation: false,
      bookedOverlap: false,
    });
    checkCarAvailabilityForRange.mockResolvedValue({
      overlappingReservation: null,
      openPhysicalRental: null,
      bookedOverlap: null,
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

  test('rejects an existing hold when a booked block appeared', async () => {
    findActiveReservationBySession.mockResolvedValue(existingHold);
    checkCarAvailabilityForRange.mockResolvedValue({
      overlappingReservation: null,
      openPhysicalRental: null,
      bookedOverlap: { id: 'block-1' },
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
    expect(extendReservationHold).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
  });

  test('rejects an existing hold when the car has an open physical rental', async () => {
    findActiveReservationBySession.mockResolvedValue(existingHold);
    checkCarAvailabilityForRange.mockResolvedValue({
      overlappingReservation: null,
      openPhysicalRental: { id: 'rental-1' },
      bookedOverlap: null,
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
    expect(changeStatus).not.toHaveBeenCalled();
  });
});
