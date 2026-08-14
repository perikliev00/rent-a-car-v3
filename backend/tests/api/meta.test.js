const request = require('supertest');
const { createApiTestApp } = require('../helpers/apiTestApp');
const { DELIVERY_FEES } = require('../../src/constants/locations');

jest.mock('../../src/services/reservationService', () => ({}));

jest.mock('../../src/services/sql/pricingConfigSqlService', () => ({
  loadPricingConfig: jest.fn(async () => ({
    seasons: [],
    weekendRules: [],
    discountRules: [],
    depositRules: [{ id: 1, name: 'Default', defaultAmount: 300, active: true }],
    deliveryFees: Object.entries(require('../../src/constants/locations').DELIVERY_FEES).map(
      ([locationId, fee]) => ({ locationId, fee })
    ),
    deliveryFeeMap: { ...require('../../src/constants/locations').DELIVERY_FEES },
    globalFees: [],
    extras: [],
  })),
  buildDefaultConfig: jest.fn(() => ({
    seasons: [],
    weekendRules: [],
    discountRules: [],
    depositRules: [{ id: 1, name: 'Default', defaultAmount: 300, active: true }],
    deliveryFees: [],
    deliveryFeeMap: { ...require('../../src/constants/locations').DELIVERY_FEES },
    globalFees: [],
    extras: [],
  })),
}));

describe('GET /api/locations', () => {
  test('returns locations and fees', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/locations').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'office', label: expect.any(String) }),
      ])
    );
    expect(response.body.data.deliveryFees).toHaveProperty('office', 0);
    expect(response.body.data.deliveryFees.office).toBe(DELIVERY_FEES.office);
  });
});

describe('GET /api/pricing-info', () => {
  test('returns pricing tiers and fees', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/pricing-info').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        deliveryFees: expect.any(Object),
        returnFees: expect.any(Object),
        priceTierExplanation: {
          tier1_3: '1-3 days',
          tier7_31: '7-31 days',
          tier31_plus: '31+ days',
        },
      })
    );
  });
});
