const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/repositories/carRepository', () => ({
  findById: jest.fn(),
}));
jest.mock('../../src/services/reservationService', () => ({
  releaseActiveReservationForSession: jest.fn(),
  createPendingReservation: jest.fn(),
  releaseAndReholdForSession: jest.fn(),
}));
jest.mock('../../src/services/admin/adminAuditService', () => ({
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));

const carRepository = require('../../src/repositories/carRepository');
const reservationService = require('../../src/services/reservationService');
const { logCustomerAction } = require('../../src/services/admin/adminAuditService');

const mockCar = {
  id: 1,
  name: 'Toyota Yaris',
  price: 45,
  priceTier_1_3: 45,
  priceTier_7_31: 40,
  priceTier_31_plus: 35,
};

const { futureSofiaDate } = require('../helpers/bookingDates');

const validReholdBody = {
  carId: 1,
  pickupDate: futureSofiaDate(7),
  returnDate: futureSofiaDate(10),
  pickupTime: '10:00',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'office',
};

describe('POST /api/reservations/release', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns success when reservation is released', async () => {
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: true });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { released: true },
    });
  });

  test('returns not found when no active reservation', async () => {
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: false });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/reservations/release-and-rehold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.findById.mockResolvedValue(mockCar);
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      ok: true,
      reservation: { id: 99 },
    });
  });

  test('returns success when reservation is re-held', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send(validReholdBody)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { reheld: true },
    });
    expect(reservationService.releaseAndReholdForSession).toHaveBeenCalled();
    expect(logCustomerAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'customer.reheld', entityId: 99 })
    );
  });

  test('returns validation error for missing fields', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns not found when car does not exist', async () => {
    carRepository.findById.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send(validReholdBody)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Car not found.');
  });

  test('returns conflict when car is already reserved', async () => {
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      ok: false,
      conflict: true,
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send(validReholdBody)
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
    expect(reservationService.releaseActiveReservationForSession).not.toHaveBeenCalled();
  });

  test('returns not found when the session has no active reservation', async () => {
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      ok: false,
      reason: 'not_found',
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send(validReholdBody)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('returns REHOLD_NOT_ALLOWED while payment is processing', async () => {
    reservationService.releaseAndReholdForSession.mockResolvedValue({
      ok: false,
      reason: 'rehold_not_allowed',
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release-and-rehold'))
      .send(validReholdBody)
      .expect(409);

    expect(response.body.error.code).toBe('REHOLD_NOT_ALLOWED');
  });
});
