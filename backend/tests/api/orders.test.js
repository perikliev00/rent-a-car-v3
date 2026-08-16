const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
const { futureSofiaDate } = require('../helpers/bookingDates');

jest.mock('../../src/repositories/carRepository');
jest.mock('../../src/services/reservationService', () => ({
  findActiveReservationBySession: jest.fn(),
  createPendingReservation: jest.fn(),
  releaseActiveReservationForSession: jest.fn(),
  attachCarNameToReservation: jest.fn(),
}));

const carRepository = require('../../src/repositories/carRepository');
const reservationService = require('../../src/services/reservationService');

const mockCar = {
  id: 1,
  make: 'Toyota',
  model: 'Corolla',
  price: 45,
};

const validOrderBody = {
  carId: 1,
  pickupDate: futureSofiaDate(7),
  returnDate: futureSofiaDate(10),
  pickupTime: '10:00',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'office',
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.findById.mockResolvedValue(mockCar);
    reservationService.findActiveReservationBySession.mockResolvedValue(null);
    reservationService.createPendingReservation.mockResolvedValue({
      overlappingReservation: false,
      bookedOverlap: false,
    });
  });

  test('returns order data on success', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        car: mockCar,
        pickupLocation: 'office',
        returnLocation: 'office',
        totalPrice: expect.any(Number),
      })
    );
    expect(reservationService.createPendingReservation).toHaveBeenCalled();
  });

  test('accepts single-digit hour times', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders'))
      .send({ ...validOrderBody, pickupTime: '9:00', returnTime: '9:30' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(reservationService.createPendingReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupTime: '09:00',
        returnTime: '09:30',
      }),
      expect.anything()
    );
  });

  test('returns validation error for missing fields', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders')).send({ carId: 1 }).expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns conflict when car is unavailable', async () => {
    reservationService.createPendingReservation.mockResolvedValue({
      overlappingReservation: true,
      bookedOverlap: false,
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  test('overlap of the same session and dates reuses the hold instead of 409', async () => {
    const { validateBookingDates } = require('../../src/utils/bookingValidation');
    const { startDate, endDate } = validateBookingDates({
      pickupDate: validOrderBody.pickupDate,
      returnDate: validOrderBody.returnDate,
      pickupTime: validOrderBody.pickupTime,
      returnTime: validOrderBody.returnTime,
    });

    const existing = {
      id: 10,
      carId: { id: 1, name: 'Toyota Corolla' },
      pickupDate: startDate,
      returnDate: endDate,
      pickupTime: '10:00',
      returnTime: '10:00',
      pickupLocation: 'office',
      returnLocation: 'office',
    };
    reservationService.findActiveReservationBySession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    reservationService.createPendingReservation.mockResolvedValue({
      overlappingReservation: true,
      bookedOverlap: false,
    });

    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    expect(response.body.success).toBe(true);
    expect(reservationService.createPendingReservation).toHaveBeenCalled();
    expect(reservationService.findActiveReservationBySession).toHaveBeenCalledTimes(2);
  });

  test('returns validation error when return date is before pickup date', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders'))
      .send({
        ...validOrderBody,
        pickupDate: futureSofiaDate(10),
        returnDate: futureSofiaDate(7),
      })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/return date must be after pick-up date/i);
    expect(reservationService.createPendingReservation).not.toHaveBeenCalled();
  });

  test('same session and same dates is idempotent without creating another hold', async () => {
    const { validateBookingDates } = require('../../src/utils/bookingValidation');
    const { startDate, endDate } = validateBookingDates({
      pickupDate: validOrderBody.pickupDate,
      returnDate: validOrderBody.returnDate,
      pickupTime: validOrderBody.pickupTime,
      returnTime: validOrderBody.returnTime,
    });

    const existing = {
      id: 10,
      carId: { id: 1, name: 'Toyota Corolla' },
      pickupDate: startDate,
      returnDate: endDate,
      pickupTime: '10:00',
      returnTime: '10:00',
      pickupLocation: 'office',
      returnLocation: 'office',
    };
    reservationService.findActiveReservationBySession.mockResolvedValue(existing);
    reservationService.attachCarNameToReservation.mockResolvedValue(existing);

    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/orders')).send(validOrderBody).expect(200);

    expect(response.body.success).toBe(true);
    expect(reservationService.createPendingReservation).not.toHaveBeenCalled();
  });
});
