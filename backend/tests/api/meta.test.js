// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../helpers/apiTestApp');
// Destructure object properties into local variables.
const { DELIVERY_FEES } = require('../../src/constants/locations');

// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/pricingConfigSqlService', () => ({
  // Provide the load pricing config field value.
  loadPricingConfig: jest.fn(async () => ({
    // Provide the seasons field value.
    seasons: [],
    // Provide the weekend rules field value.
    weekendRules: [],
    // Provide the discount rules field value.
    discountRules: [],
    // Provide the deposit rules field value.
    depositRules: [{ id: 1, name: 'Default', defaultAmount: 300, active: true }],
    // Provide the delivery fees field value.
    deliveryFees: Object.entries(require('../../src/constants/locations').DELIVERY_FEES).map(
      // Continue the surrounding logic with this statement.
      ([locationId, fee]) => ({ locationId, fee })
    ),
    // Provide the delivery fee map field value.
    deliveryFeeMap: { ...require('../../src/constants/locations').DELIVERY_FEES },
    // Provide the global fees field value.
    globalFees: [],
    // Provide the extras field value.
    extras: [],
  })),
  // Provide the build default config field value.
  buildDefaultConfig: jest.fn(() => ({
    // Provide the seasons field value.
    seasons: [],
    // Provide the weekend rules field value.
    weekendRules: [],
    // Provide the discount rules field value.
    discountRules: [],
    // Provide the deposit rules field value.
    depositRules: [{ id: 1, name: 'Default', defaultAmount: 300, active: true }],
    // Provide the delivery fees field value.
    deliveryFees: [],
    // Provide the delivery fee map field value.
    deliveryFeeMap: { ...require('../../src/constants/locations').DELIVERY_FEES },
    // Provide the global fees field value.
    globalFees: [],
    // Provide the extras field value.
    extras: [],
  })),
}));

// Declare a test suite grouping related cases.
describe('GET /api/locations', () => {
  // Define a single test case and its expectations.
  test('returns locations and fees', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/locations').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.locations).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining([
        // Call expect.objectContaining to perform this step.
        expect.objectContaining({ id: 'office', label: expect.any(String) }),
      ])
    );
    // Assert that the value matches the intended expectation.
    expect(response.body.data.deliveryFees).toHaveProperty('office', 0);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.deliveryFees.office).toBe(DELIVERY_FEES.office);
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/pricing-info', () => {
  // Define a single test case and its expectations.
  test('returns pricing tiers and fees', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/pricing-info').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the delivery fees field value.
        deliveryFees: expect.any(Object),
        // Provide the return fees field value.
        returnFees: expect.any(Object),
        // Provide the price tier explanation field value.
        priceTierExplanation: {
          // Provide the tier1 3 field value.
          tier1_3: '1-3 days',
          // Provide the tier7 31 field value.
          tier7_31: '7-31 days',
          // Provide the tier31 plus field value.
          tier31_plus: '31+ days',
        },
      })
    );
  });
});
