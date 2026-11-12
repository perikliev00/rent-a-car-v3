// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../helpers/apiTestApp');
// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');

// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the purge expired field value.
  purgeExpired: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({}));

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
  // Provide the transmission field value.
  transmission: 'automatic',
  // Provide the fuel type field value.
  fuelType: 'petrol',
  // Provide the seats field value.
  seats: 5,
};

// Declare a test suite grouping related cases.
describe('apiResponse helpers', () => {
  // Define a single test case and its expectations.
  test('success returns standard envelope', () => {
    // Destructure object properties into local variables.
    const { success } = require('../../src/utils/apiResponse');
    // Create the json constant.
    const json = jest.fn();
    // Create the res constant.
    const res = { status: jest.fn(() => ({ json })) };

    // Call success to perform this step.
    success(res, { items: [1] });

    // Assert that the value matches the intended expectation.
    expect(res.status).toHaveBeenCalledWith(200);
    // Assert that the value matches the intended expectation.
    expect(json).toHaveBeenCalledWith({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { items: [1] },
    });
  });

  // Define a single test case and its expectations.
  test('error returns standard envelope', () => {
    // Destructure object properties into local variables.
    const { error } = require('../../src/utils/apiResponse');
    // Create the json constant.
    const json = jest.fn();
    // Create the res constant.
    const res = { status: jest.fn(() => ({ json })) };

    // Call error to perform this step.
    error(res, 'NOT_FOUND', 'Car not found', 404);

    // Assert that the value matches the intended expectation.
    expect(res.status).toHaveBeenCalledWith(404);
    // Assert that the value matches the intended expectation.
    expect(json).toHaveBeenCalledWith({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'Car not found',
      },
    });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/cars', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.paginate.mockResolvedValue to perform this step.
    carRepository.paginate.mockResolvedValue({
      // Provide the cars field value.
      cars: [mockCar],
      // Provide the current page field value.
      currentPage: 1,
      // Provide the total pages field value.
      totalPages: 1,
    });
    // Call carRepository.parsePage.mockReturnValue to perform this step.
    carRepository.parsePage.mockReturnValue(1);
  });

  // Define a single test case and its expectations.
  test('returns JSON success envelope', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: expect.objectContaining({
        // Provide the cars field value.
        cars: [mockCar],
        // Provide the pagination field value.
        pagination: { currentPage: 1, totalPages: 1 },
        // Provide the pickup date iso field value.
        pickupDateISO: expect.any(String),
        // Provide the return date iso field value.
        returnDateISO: expect.any(String),
        // Provide the category id field value.
        categoryId: null,
        // Provide the filters field value.
        filters: expect.any(Object),
      }),
    });
    // Assert that the value matches the intended expectation.
    expect(carRepository.paginate).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('handles trailing slash', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars/').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.cars).toEqual([mockCar]);
  });

  // Define a single test case and its expectations.
  test('passes categoryId filter to repository', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Wait until the asynchronous operation resolves.
    await request(app)
      // Call .get to perform this step.
      .get('/api/cars')
      // Call .query to perform this step.
      .query({ categoryId: '2', page: '2' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(carRepository.parsePage).toHaveBeenCalledWith('2');
    // Assert that the value matches the intended expectation.
    expect(carRepository.paginate).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ categoryId: 2 }),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ page: 1, rentalDays: 1 })
    );
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid list filters', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/cars')
      // Call .query to perform this step.
      .query({ page: '0', transmission: 'invalid' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/cars/search', () => {
  // Create the valid search query constant.
  const validSearchQuery = {
    // Supply the literal value used by the enclosing expression.
    'pickup-date': '2030-07-15',
    // Supply the literal value used by the enclosing expression.
    'return-date': '2030-07-20',
    // Supply the literal value used by the enclosing expression.
    'pickup-time': '10:00',
    // Supply the literal value used by the enclosing expression.
    'return-time': '10:00',
    // Supply the literal value used by the enclosing expression.
    'pickup-location': 'office',
    // Supply the literal value used by the enclosing expression.
    'return-location': 'office',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.paginate.mockResolvedValue to perform this step.
    carRepository.paginate.mockResolvedValue({
      // Provide the cars field value.
      cars: [mockCar],
      // Provide the current page field value.
      currentPage: 1,
      // Provide the total pages field value.
      totalPages: 1,
    });
    // Call carRepository.parsePage.mockReturnValue to perform this step.
    carRepository.parsePage.mockReturnValue(1);
  });

  // Define a single test case and its expectations.
  test('returns JSON success envelope with priced cars', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/cars/search')
      // Call .query to perform this step.
      .query(validSearchQuery)
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the cars field value.
        cars: expect.arrayContaining([
          // Call expect.objectContaining to perform this step.
          expect.objectContaining({
            // Provide the id field value.
            id: 1,
            // Provide the make field value.
            make: 'Toyota',
            // Provide the unit price field value.
            unitPrice: expect.any(Number),
          }),
        ]),
        // Provide the pagination field value.
        pagination: { currentPage: 1, totalPages: 1 },
        // Provide the search field value.
        search: {
          // Provide the pickup location field value.
          pickupLocation: 'office',
          // Provide the return location field value.
          returnLocation: 'office',
          // Provide the pickup date field value.
          pickupDate: '2030-07-15',
          // Provide the return date field value.
          returnDate: '2030-07-20',
          // Provide the pickup time field value.
          pickupTime: '10:00',
          // Provide the return time field value.
          returnTime: '10:00',
        },
        // Provide the rental days field value.
        rentalDays: expect.any(Number),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(carRepository.paginate).toHaveBeenCalledWith(
      // Call expect.any to perform this step.
      expect.any(Object),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ onlyAvailable: true })
    );
  });

  // Define a single test case and its expectations.
  test('normalizes single-digit hour search times', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/cars/search')
      // Call .query to perform this step.
      .query({ ...validSearchQuery, 'pickup-time': '9:00', 'return-time': '9:30' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.search.pickupTime).toBe('09:00');
    // Assert that the value matches the intended expectation.
    expect(response.body.data.search.returnTime).toBe('09:30');
  });

  // Define a single test case and its expectations.
  test('returns validation error envelope for missing params', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars/search').expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: expect.any(String),
      },
    });
  });
});
