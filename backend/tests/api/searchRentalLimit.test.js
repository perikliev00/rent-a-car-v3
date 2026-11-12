const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');

jest.mock('../../src/utils/pricing/calculateRentalPrice', () => ({
  computePrice: jest.fn(() => {
    throw new Error('pricing must not run for an over-limit search');
  }),
}));

const { computePrice } = require('../../src/utils/pricing/calculateRentalPrice');

describe('public search rental limit', () => {
  beforeEach(() => {
    computePrice.mockClear();
  });

  test.each(['/api/cars/search', '/api/v1/cars/search'])(
    '%s returns 422 before pricing for an excessive range',
    async (path) => {
      const app = createApiTestApp();
      const response = await request(app)
        .get(path)
        .query({
          'pickup-date': '2026-11-01',
          'return-date': '9999-12-31',
          'pickup-time': '10:00',
          'return-time': '10:00',
          'pickup-location': 'burgas-airport',
          'return-location': 'burgas-airport',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(computePrice).not.toHaveBeenCalled();
    }
  );
});
