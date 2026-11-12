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

// Declare a test suite grouping related cases.
describe('API versioning dual-mount', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.paginate.mockResolvedValue to perform this step.
    carRepository.paginate.mockResolvedValue({
      // Provide the cars field value.
      cars: [],
      // Provide the current page field value.
      currentPage: 1,
      // Provide the total pages field value.
      totalPages: 1,
    });
    // Call carRepository.parsePage.mockReturnValue to perform this step.
    carRepository.parsePage.mockReturnValue(1);
  });

  // Define a single test case and its expectations.
  test('GET /api/v1/cars and GET /api/cars both succeed', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the v1 constant.
    const v1 = await request(app).get('/api/v1/cars').expect(200);
    // Assert that the value matches the intended expectation.
    expect(v1.body.success).toBe(true);

    // Create the alias constant.
    const alias = await request(app).get('/api/cars').expect(200);
    // Assert that the value matches the intended expectation.
    expect(alias.body.success).toBe(true);
  });

  // Define a single test case and its expectations.
  test('Swagger docs are available under /api/v1/docs', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the res constant.
    const res = await request(app).get('/api/v1/docs/openapi.json').expect(200);
    // Assert that the value matches the intended expectation.
    expect(res.body.openapi).toBe('3.0.3');
    // Assert that the value matches the intended expectation.
    expect(res.body.paths['/webhook/stripe']).toBeDefined();
  });
});
