// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../helpers/apiTestApp');
// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');

// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository');
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
describe('GET /api/cars/:carId', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(mockCar);
  });

  // Define a single test case and its expectations.
  test('returns car by id', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars/1').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { car: mockCar },
    });
    // Assert that the value matches the intended expectation.
    expect(carRepository.findById).toHaveBeenCalledWith('1');
  });

  // Define a single test case and its expectations.
  test('returns 404 when car is missing', async () => {
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars/99').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'Car not found.',
      },
    });
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid id', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/cars/abc').expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
