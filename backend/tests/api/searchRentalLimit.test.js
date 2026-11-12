// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/utils/pricing/calculateRentalPrice', () => ({
  // Provide the compute price field value.
  computePrice: jest.fn(() => {
    // Throw an error to stop the current control flow.
    throw new Error('pricing must not run for an over-limit search');
  }),
}));

// Destructure object properties into local variables.
const { computePrice } = require('../../src/utils/pricing/calculateRentalPrice');

// Declare a test suite grouping related cases.
describe('public search rental limit', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call computePrice.mockClear to perform this step.
    computePrice.mockClear();
  });

  // Call test.each to perform this step.
  test.each(['/api/cars/search', '/api/v1/cars/search'])(
    // Supply the literal value used by the enclosing expression.
    '%s returns 422 before pricing for an excessive range',
    // Call async to perform this step.
    async (path) => {
      // Create the app constant.
      const app = createApiTestApp();
      // Create the response constant.
      const response = await request(app)
        // Call .get to perform this step.
        .get(path)
        // Call .query to perform this step.
        .query({
          // Supply the literal value used by the enclosing expression.
          'pickup-date': '2026-11-01',
          // Supply the literal value used by the enclosing expression.
          'return-date': '9999-12-31',
          // Supply the literal value used by the enclosing expression.
          'pickup-time': '10:00',
          // Supply the literal value used by the enclosing expression.
          'return-time': '10:00',
          // Supply the literal value used by the enclosing expression.
          'pickup-location': 'burgas-airport',
          // Supply the literal value used by the enclosing expression.
          'return-location': 'burgas-airport',
        })
        // Call .expect to perform this step.
        .expect(422);

      // Assert that the value matches the intended expectation.
      expect(response.body.success).toBe(false);
      // Assert that the value matches the intended expectation.
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Assert that the value matches the intended expectation.
      expect(computePrice).not.toHaveBeenCalled();
    }
  );
});
