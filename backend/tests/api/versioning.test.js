const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');
const carRepository = require('../../src/repositories/carRepository');

jest.mock('../../src/repositories/carRepository');
jest.mock('../../src/services/sql/bookingSyncSqlService', () => ({
  purgeExpired: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/reservationService', () => ({}));

describe('API versioning dual-mount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.paginate.mockResolvedValue({
      cars: [],
      currentPage: 1,
      totalPages: 1,
    });
    carRepository.parsePage.mockReturnValue(1);
  });

  test('GET /api/v1/cars and GET /api/cars both succeed', async () => {
    const app = createApiTestApp();

    const v1 = await request(app).get('/api/v1/cars').expect(200);
    expect(v1.body.success).toBe(true);

    const alias = await request(app).get('/api/cars').expect(200);
    expect(alias.body.success).toBe(true);
  });

  test('Swagger docs are available under /api/v1/docs', async () => {
    const app = createApiTestApp();
    const res = await request(app).get('/api/v1/docs/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/webhook/stripe']).toBeDefined();
  });
});
