// Call jest.mock to perform this step.
jest.mock('../../../../src/services/reservationService', () => ({
  // Provide the find active reservation by session field value.
  findActiveReservationBySession: jest.fn(),
  // Provide the attach car name to reservation field value.
  attachCarNameToReservation: jest.fn(async (reservation) => reservation),
  // Provide the extend reservation hold field value.
  extendReservationHold: jest.fn(),
  // Provide the create pending reservation field value.
  createPendingReservation: jest.fn(),
  // Provide the check car availability for range field value.
  checkCarAvailabilityForRange: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/paymentService', () => ({
  // Provide the normalize contact details field value.
  normalizeContactDetails: jest.fn((data) => data),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
}));

// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  findActiveReservationBySession,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  checkCarAvailabilityForRange,
  // Contribute this line to the enclosing declaration or statement.
  extendReservationHold,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/reservationService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const { resolveCheckoutReservation } = require('../../../../src/services/payment/checkout/checkoutReservationService');

// Declare a test suite grouping related cases.
describe('resolveCheckoutReservation', () => {
  // Create the car constant.
  const car = { id: 1, name: 'Yaris' };
  // Create the form data constant.
  const formData = {
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return time field value.
    returnTime: '10:00',
    // Provide the pickup location field value.
    pickupLocation: 'office',
    // Provide the return location field value.
    returnLocation: 'office',
    // Provide the full name field value.
    fullName: 'Jane',
    // Provide the email field value.
    email: 'jane@example.com',
  };
  // Create the start date constant.
  const startDate = new Date('2026-08-01T07:00:00.000Z');
  // Create the end date constant.
  const endDate = new Date('2026-08-05T07:00:00.000Z');
  // Create the pricing constant.
  const pricing = { rentalDays: 4, totalPrice: 180, deliveryPrice: 0, returnPrice: 0 };
  // Create the existing hold constant.
  const existingHold = {
    // Provide the id field value.
    id: 'hold-1',
    // Provide the car id field value.
    carId: 1,
    // Provide the pickup date field value.
    pickupDate: startDate,
    // Provide the return date field value.
    returnDate: endDate,
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call findActiveReservationBySession.mockResolvedValue to perform this step.
    findActiveReservationBySession.mockResolvedValue(null);
    // Call createPendingReservation.mockResolvedValue to perform this step.
    createPendingReservation.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: '99' },
      // Provide the overlapping reservation field value.
      overlappingReservation: false,
      // Provide the booked overlap field value.
      bookedOverlap: false,
    });
    // Call checkCarAvailabilityForRange.mockResolvedValue to perform this step.
    checkCarAvailabilityForRange.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: null,
      // Provide the open physical rental field value.
      openPhysicalRental: null,
      // Provide the booked overlap field value.
      bookedOverlap: null,
    });
  });

  // Define a single test case and its expectations.
  test('creates a new reservation when none exists', async () => {
    // Create the result constant.
    const result = await resolveCheckoutReservation({
      // Provide the req field value.
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.createdReservationThisStep).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns conflict when booked overlap exists', async () => {
    // Call createPendingReservation.mockResolvedValue to perform this step.
    createPendingReservation.mockResolvedValue({
      // Provide the reservation field value.
      reservation: null,
      // Provide the overlapping reservation field value.
      overlappingReservation: false,
      // Provide the booked overlap field value.
      bookedOverlap: true,
    });

    // Create the result constant.
    const result = await resolveCheckoutReservation({
      // Provide the req field value.
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.message).toContain('booked');
  });

  // Define a single test case and its expectations.
  test('rejects an existing hold when a booked block appeared', async () => {
    // Call findActiveReservationBySession.mockResolvedValue to perform this step.
    findActiveReservationBySession.mockResolvedValue(existingHold);
    // Call checkCarAvailabilityForRange.mockResolvedValue to perform this step.
    checkCarAvailabilityForRange.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: null,
      // Provide the open physical rental field value.
      openPhysicalRental: null,
      // Provide the booked overlap field value.
      bookedOverlap: { id: 'block-1' },
    });

    // Create the result constant.
    const result = await resolveCheckoutReservation({
      // Provide the req field value.
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.message).toContain('booked');
    // Assert that the value matches the intended expectation.
    expect(extendReservationHold).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('rejects an existing hold when the car has an open physical rental', async () => {
    // Call findActiveReservationBySession.mockResolvedValue to perform this step.
    findActiveReservationBySession.mockResolvedValue(existingHold);
    // Call checkCarAvailabilityForRange.mockResolvedValue to perform this step.
    checkCarAvailabilityForRange.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: null,
      // Provide the open physical rental field value.
      openPhysicalRental: { id: 'rental-1' },
      // Provide the booked overlap field value.
      bookedOverlap: null,
    });

    // Create the result constant.
    const result = await resolveCheckoutReservation({
      // Provide the req field value.
      req: { session: { _sid: 'sess-1' }, sessionID: 'sess-1', originalUrl: '/checkout' },
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.message).toContain('booked');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });
});
