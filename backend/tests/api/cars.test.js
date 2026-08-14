const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');
const carRepository = require('../../src/repositories/carRepository');

jest.mock('../../src/repositories/carRepository');
jest.mock('../../src/services/sql/bookingSyncSqlService', () => ({
  purgeExpired: jest.fn().mockResolvedValue(undefined),
}));
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

describe('apiResponse helpers', () => {
  test('success returns standard envelope', () => {
    const { success } = require('../../src/utils/apiResponse');
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };

    success(res, { items: [1] });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { items: [1] },
    });
  });

  test('error returns standard envelope', () => {
    const { error } = require('../../src/utils/apiResponse');
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };

    error(res, 'NOT_FOUND', 'Car not found', 404);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Car not found',
      },
    });
  });
});

describe('GET /api/cars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.paginate.mockResolvedValue({
      cars: [mockCar],
      currentPage: 1,
      totalPages: 1,
    });
    carRepository.parsePage.mockReturnValue(1);
  });

  test('returns JSON success envelope', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        cars: [mockCar],
        pagination: { currentPage: 1, totalPages: 1 },
        pickupDateISO: expect.any(String),
        returnDateISO: expect.any(String),
        categoryId: null,
        filters: expect.any(Object),
      }),
    });
    expect(carRepository.paginate).toHaveBeenCalled();
  });

  test('handles trailing slash', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars/').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.cars).toEqual([mockCar]);
  });

  test('passes categoryId filter to repository', async () => {
    const app = createApiTestApp();

    await request(app)
      .get('/api/cars')
      .query({ categoryId: '2', page: '2' })
      .expect(200);

    expect(carRepository.parsePage).toHaveBeenCalledWith('2');
    expect(carRepository.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 2 }),
      expect.objectContaining({ page: 1, rentalDays: 1 })
    );
  });

  test('returns validation error for invalid list filters', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/cars')
      .query({ page: '0', transmission: 'invalid' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/cars/search', () => {
  const validSearchQuery = {
    'pickup-date': '2030-07-15',
    'return-date': '2030-07-20',
    'pickup-time': '10:00',
    'return-time': '10:00',
    'pickup-location': 'office',
    'return-location': 'office',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.paginate.mockResolvedValue({
      cars: [mockCar],
      currentPage: 1,
      totalPages: 1,
    });
    carRepository.parsePage.mockReturnValue(1);
  });

  test('returns JSON success envelope with priced cars', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/cars/search')
      .query(validSearchQuery)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        cars: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            make: 'Toyota',
            unitPrice: expect.any(Number),
          }),
        ]),
        pagination: { currentPage: 1, totalPages: 1 },
        search: {
          pickupLocation: 'office',
          returnLocation: 'office',
          pickupDate: '2030-07-15',
          returnDate: '2030-07-20',
          pickupTime: '10:00',
          returnTime: '10:00',
        },
        rentalDays: expect.any(Number),
      })
    );
    expect(carRepository.paginate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ onlyAvailable: true })
    );
  });

  test('normalizes single-digit hour search times', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/cars/search')
      .query({ ...validSearchQuery, 'pickup-time': '9:00', 'return-time': '9:30' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.search.pickupTime).toBe('09:00');
    expect(response.body.data.search.returnTime).toBe('09:30');
  });

  test('returns validation error envelope for missing params', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/cars/search').expect(422);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      },
    });
  });
});
