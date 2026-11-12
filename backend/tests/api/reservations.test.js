// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({
  // Provide the release active reservation for session field value.
  releaseActiveReservationForSession: jest.fn(),
  // Provide the create pending reservation field value.
  createPendingReservation: jest.fn(),
  // Provide the release and rehold for session field value.
  releaseAndReholdForSession: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/admin/adminAuditService', () => ({
  // Provide the log customer action field value.
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));

// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');
// Require the '../../src/services/reservationService' module as reservationService.
const reservationService = require('../../src/services/reservationService');
// Destructure object properties into local variables.
const { logCustomerAction } = require('../../src/services/admin/adminAuditService');

// Create the mock car constant.
const mockCar = {
  // Provide the id field value.
  id: 1,
  // Provide the name field value.
  name: 'Toyota Yaris',
  // Provide the price field value.
  price: 45,
  // Provide the price tier 1 3 field value.
  priceTier_1_3: 45,
  // Provide the price tier 7 31 field value.
  priceTier_7_31: 40,
  // Provide the price tier 31 plus field value.
  priceTier_31_plus: 35,
};

// Destructure object properties into local variables.
const { futureSofiaDate } = require('../helpers/bookingDates');

// Create the valid rehold body constant.
const validReholdBody = {
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
describe('POST /api/reservations/release', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('returns success when reservation is released', async () => {
    // Call reservationService.releaseActiveReservationForSession.mockResolvedValue to perform this step.
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: true });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { released: true },
    });
  });

  // Define a single test case and its expectations.
  test('returns not found when no active reservation', async () => {
    // Call reservationService.releaseActiveReservationForSession.mockResolvedValue to perform this step.
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: false });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/reservations/release-and-rehold', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(mockCar);
    // Call reservationService.releaseAndReholdForSession.mockResolvedValue to perform this step.
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      // Provide the ok field value.
      ok: true,
      // Provide the reservation field value.
      reservation: { id: 99 },
    });
  });

  // Define a single test case and its expectations.
  test('returns success when reservation is re-held', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send(validReholdBody)
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { reheld: true },
    });
    // Assert that the value matches the intended expectation.
    expect(reservationService.releaseAndReholdForSession).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(logCustomerAction).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ action: 'customer.reheld', entityId: 99 })
    );
  });

  // Define a single test case and its expectations.
  test('returns validation error for missing fields', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns not found when car does not exist', async () => {
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send(validReholdBody)
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Car not found.');
  });

  // Define a single test case and its expectations.
  test('returns conflict when car is already reserved', async () => {
    // Call reservationService.releaseAndReholdForSession.mockResolvedValue to perform this step.
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      // Provide the ok field value.
      ok: false,
      // Provide the conflict field value.
      conflict: true,
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send(validReholdBody)
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CONFLICT');
    // Assert that the value matches the intended expectation.
    expect(reservationService.releaseActiveReservationForSession).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns not found when the session has no active reservation', async () => {
    // Call reservationService.releaseAndReholdForSession.mockResolvedValue to perform this step.
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'not_found',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send(validReholdBody)
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('returns REHOLD_NOT_ALLOWED while payment is processing', async () => {
    // Call reservationService.releaseAndReholdForSession.mockResolvedValue to perform this step.
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'rehold_not_allowed',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      // Call .send to perform this step.
      .send(validReholdBody)
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('REHOLD_NOT_ALLOWED');
  });
});
