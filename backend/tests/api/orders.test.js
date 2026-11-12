// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
// Destructure object properties into local variables.
const { futureSofiaDate } = require('../helpers/bookingDates');

// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository');
// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({
  // Provide the find active reservation by session field value.
  findActiveReservationBySession: jest.fn(),
  // Provide the create pending reservation field value.
  createPendingReservation: jest.fn(),
  // Provide the release active reservation for session field value.
  releaseActiveReservationForSession: jest.fn(),
  // Provide the attach car name to reservation field value.
  attachCarNameToReservation: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/pricingConfigSqlService', () => {
  // Destructure object properties into local variables.
  const { DELIVERY_FEES } = require('../../src/constants/locations');
  // Create the config constant.
  const config = {
    // Provide the seasons field value.
    seasons: [],
    // Provide the weekend rules field value.
    weekendRules: [],
    // Provide the discount rules field value.
    discountRules: [],
    // Provide the deposit rules field value.
    depositRules: [{ id: 1, name: 'Default', defaultAmount: 300, active: true }],
    // Provide the delivery fees field value.
    deliveryFees: Object.entries(DELIVERY_FEES).map(([locationId, fee]) => ({ locationId, fee })),
    // Provide the delivery fee map field value.
    deliveryFeeMap: { ...DELIVERY_FEES },
    // Provide the global fees field value.
    globalFees: [],
    // Provide the extras field value.
    extras: [],
  };
  // Return the resulting value to the caller.
  return {
    // Provide the load pricing config field value.
    loadPricingConfig: jest.fn(async () => config),
    // Provide the build default config field value.
    buildDefaultConfig: jest.fn(() => config),
  };
});

// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');
// Require the '../../src/services/reservationService' module as reservationService.
const reservationService = require('../../src/services/reservationService');

// Create the mock car constant.
const mockCar = {
  // Provide the id field value.
  id: 1,
  // Provide the make field value.
  make: 'Toyota',
  // Provide the model field value.
  model: 'Corolla',
  // Provide the price field value.
  price: 45,
};

// Create the valid order body constant.
const validOrderBody = {
  // Provide the car id field value.
  carId: 1,
  // Provide the pickup date field value.
  pickupDate: futureSofiaDate(7),
  // Provide the return date field value.
  returnDate: futureSofiaDate(10),
  // Provide the pickup time field value.
  pickupTime: '10:00',
  // Provide the return time field value.
  returnTime: '10:00',
  // Provide the pickup location field value.
  pickupLocation: 'office',
  // Provide the return location field value.
  returnLocation: 'office',
};

// Declare a test suite grouping related cases.
describe('POST /api/orders', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(15000);

  // Reserve the agent variable for later assignment.
  let agent;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Store the awaited result in agent.
    agent = await initTestAgent(app);
  });

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(mockCar);
    // Call reservationService.findActiveReservationBySession.mockResolvedValue to perform this step.
    reservationService.findActiveReservationBySession.mockResolvedValue(null);
    // Call reservationService.createPendingReservation.mockResolvedValue to perform this step.
    reservationService.createPendingReservation.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: false,
      // Provide the booked overlap field value.
      bookedOverlap: false,
    });
  });

  // Define a single test case and its expectations.
  test('returns order data on success', async () => {
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the car field value.
        car: mockCar,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the total price field value.
        totalPrice: expect.any(Number),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(reservationService.createPendingReservation).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('accepts single-digit hour times', async () => {
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders'))
      // Call .send to perform this step.
      .send({ ...validOrderBody, pickupTime: '9:00', returnTime: '9:30' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(reservationService.createPendingReservation).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the pickup time field value.
        pickupTime: '09:00',
        // Provide the return time field value.
        returnTime: '09:30',
      }),
      // Call expect.anything to perform this step.
      expect.anything()
    );
  });

  // Define a single test case and its expectations.
  test('returns validation error for missing fields', async () => {
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders')).send({ carId: 1 }).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns conflict when car is unavailable', async () => {
    // Call reservationService.createPendingReservation.mockResolvedValue to perform this step.
    reservationService.createPendingReservation.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: true,
      // Provide the booked overlap field value.
      bookedOverlap: false,
    });

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CONFLICT');
  });

  // Define a single test case and its expectations.
  test('overlap of the same session and dates reuses the hold instead of 409', async () => {
    // Destructure object properties into local variables.
    const { validateBookingDates } = require('../../src/utils/bookingValidation');
    // Destructure object properties into local variables.
    const { startDate, endDate } = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: validOrderBody.pickupDate,
      // Provide the return date field value.
      returnDate: validOrderBody.returnDate,
      // Provide the pickup time field value.
      pickupTime: validOrderBody.pickupTime,
      // Provide the return time field value.
      returnTime: validOrderBody.returnTime,
    });

    // Create the existing constant.
    const existing = {
      // Provide the id field value.
      id: 10,
      // Provide the car id field value.
      carId: { id: 1, name: 'Toyota Corolla' },
      // Provide the pickup date field value.
      pickupDate: startDate,
      // Provide the return date field value.
      returnDate: endDate,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
    };
    // Contribute this line to the enclosing declaration or statement.
    reservationService.findActiveReservationBySession
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(existing);
    // Call reservationService.createPendingReservation.mockResolvedValue to perform this step.
    reservationService.createPendingReservation.mockResolvedValue({
      // Provide the overlapping reservation field value.
      overlappingReservation: true,
      // Provide the booked overlap field value.
      bookedOverlap: false,
    });

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(reservationService.createPendingReservation).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(reservationService.findActiveReservationBySession).toHaveBeenCalledTimes(2);
  });

  // Define a single test case and its expectations.
  test('returns validation error when return date is before pickup date', async () => {
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders'))
      // Call .send to perform this step.
      .send({
        // Spread validOrderBody into the surrounding structure.
        ...validOrderBody,
        // Provide the pickup date field value.
        pickupDate: futureSofiaDate(10),
        // Provide the return date field value.
        returnDate: futureSofiaDate(7),
      })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toMatch(/return date must be after pick-up date/i);
    // Assert that the value matches the intended expectation.
    expect(reservationService.createPendingReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('same session and same dates is idempotent without creating another hold', async () => {
    // Destructure object properties into local variables.
    const { validateBookingDates } = require('../../src/utils/bookingValidation');
    // Destructure object properties into local variables.
    const { startDate, endDate } = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: validOrderBody.pickupDate,
      // Provide the return date field value.
      returnDate: validOrderBody.returnDate,
      // Provide the pickup time field value.
      pickupTime: validOrderBody.pickupTime,
      // Provide the return time field value.
      returnTime: validOrderBody.returnTime,
    });

    // Create the existing constant.
    const existing = {
      // Provide the id field value.
      id: 10,
      // Provide the car id field value.
      carId: { id: 1, name: 'Toyota Corolla' },
      // Provide the pickup date field value.
      pickupDate: startDate,
      // Provide the return date field value.
      returnDate: endDate,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
    };
    // Call reservationService.findActiveReservationBySession.mockResolvedValue to perform this step.
    reservationService.findActiveReservationBySession.mockResolvedValue(existing);
    // Call reservationService.attachCarNameToReservation.mockResolvedValue to perform this step.
    reservationService.attachCarNameToReservation.mockResolvedValue(existing);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(reservationService.createPendingReservation).not.toHaveBeenCalled();
  });
});
