const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');
const carRepository = require('../../src/repositories/carRepository');

jest.mock('../../src/repositories/carRepository');
jest.mock('../../src/services/reservationService', () => ({}));

const mockCar = {
  id: 1,
  make: 'Toyota',
  model: 'Corolla',
  price: 45,
  transmission: 'automatic',
  fuelType: 'petrol',
  seats: 5,
};

describe('GET /api/cars/:carId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.findById.mockResolvedValue(mockCar);
  });

  test('returns car by id', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars/1').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { car: mockCar },
    });
    expect(carRepository.findById).toHaveBeenCalledWith('1');
  });

  test('returns 404 when car is missing', async () => {
    carRepository.findById.mockResolvedValue(null);
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars/99').expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Car not found.',
      },
    });
  });

  test('returns validation error for invalid id', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars/abc').expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
