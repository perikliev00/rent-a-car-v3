const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');

jest.mock('../../src/repositories/carRepository');
jest.mock('../../src/services/sql/bookingSyncSqlService', () => ({
  purgeExpired: jest.fn().mockResolvedValue(undefined),
}));

const carRepository = require('../../src/repositories/carRepository');

const mockCar = {
  id: 1,
  name: 'Toyota Yaris',
  make: 'Toyota',
  model: 'Yaris',
  price: 45,
  transmission: 'automatic',
  fuelType: 'petrol',
  seats: 5,
  category: 'Economy',
  categoryId: 1,
};

describe('/api/chat response contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.listAvailable.mockResolvedValue([mockCar]);
    carRepository.listByFilter.mockResolvedValue([mockCar]);
    carRepository.findById.mockResolvedValue(mockCar);
  });

  test('GET /api/chat/cars-summary returns raw JSON without success envelope', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/chat/cars-summary').expect(200);

    expect(response.body.success).toBeUndefined();
    expect(response.body).toEqual(
      expect.objectContaining({
        totalCars: 1,
        fuelTypes: expect.any(Array),
        transmissions: expect.any(Array),
        seatOptions: expect.any(Array),
        priceRange: expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }),
        priceTiers: expect.objectContaining({
          tier1_3: expect.any(Object),
          tier7_31: expect.any(Object),
          tier31_plus: expect.any(Object),
        }),
      })
    );
  });

  test('GET /api/chat/pricing-info returns raw pricing payload', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/chat/pricing-info').expect(200);

    expect(response.body.success).toBeUndefined();
    expect(response.body).toEqual(
      expect.objectContaining({
        deliveryFees: expect.any(Object),
        returnFees: expect.any(Object),
        priceTierExplanation: expect.any(Object),
      })
    );
  });

  test('GET /api/chat/cars-by-filter returns raw car array', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/chat/cars-by-filter')
      .query({ categoryId: '1', transmission: 'Automatic' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toEqual(expect.objectContaining({ id: 1 }));
    expect(carRepository.listByFilter).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: '1', transmission: 'Automatic' })
    );
  });

  test('GET /api/chat/cars-by-filter returns validation error envelope', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/chat/cars-by-filter')
      .query({ fuelType: 'invalid-fuel' })
      .expect(400);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      })
    );
  });

  test('GET /api/chat/car-details/:carId returns raw car object', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/chat/car-details/1').expect(200);

    expect(response.body.success).toBeUndefined();
    expect(response.body).toEqual(expect.objectContaining({ id: 1, name: 'Toyota Yaris' }));
  });

  test('GET /api/chat/car-details/:carId returns not found error envelope', async () => {
    carRepository.findById.mockResolvedValue(null);
    const app = createApiTestApp();

    const response = await request(app).get('/api/chat/car-details/999').expect(404);

    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Car not found',
      })
    );
  });

  test('GET /api/chat/cars-summary returns empty summary when no cars', async () => {
    carRepository.listAvailable.mockResolvedValue([]);
    const app = createApiTestApp();

    const response = await request(app).get('/api/chat/cars-summary').expect(200);

    expect(response.body.success).toBeUndefined();
    expect(response.body).toEqual({
      totalCars: 0,
      fuelTypes: [],
      transmissions: [],
      seatOptions: [],
      priceRange: { min: 0, max: 0 },
      priceTiers: {
        tier1_3: { min: 0, max: 0 },
        tier7_31: { min: 0, max: 0 },
        tier31_plus: { min: 0, max: 0 },
      },
    });
  });

  test('GET /api/chat/cars-by-filter returns validation error for out-of-range seatsMin', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/chat/cars-by-filter')
      .query({ seatsMin: '99' })
      .expect(400);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'seatsMin must be an integer between 2 and 9.',
        details: expect.any(Array),
      })
    );
  });
});
