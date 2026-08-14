jest.mock('../../../src/services/sql/pricingConfigSqlService', () => ({
  loadPricingConfig: jest.fn(),
  buildDefaultConfig: jest.fn(() => ({
    seasons: [],
    weekendRules: [],
    discountRules: [],
    depositRules: [{ id: 0, name: 'Default deposit', defaultAmount: 300, active: true }],
    deliveryFees: [],
    deliveryFeeMap: {},
    globalFees: [],
    extras: [],
  })),
}));

jest.mock('../../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const {
  loadPricingConfig,
  buildDefaultConfig,
} = require('../../../src/services/sql/pricingConfigSqlService');
const { computeBookingPriceAsync } = require('../../../src/utils/pricing/calculateRentalPrice');

describe('computeBookingPriceAsync', () => {
  const car = { price: 50, priceTier_1_3: 60, priceTier_7_31: 45, priceTier_31_plus: 35 };
  const start = new Date('2026-07-01T10:00:00Z');
  const end = new Date('2026-07-03T10:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects when pricing config cannot be loaded (fail closed)', async () => {
    const err = new Error('db unavailable');
    loadPricingConfig.mockRejectedValue(err);

    await expect(
      computeBookingPriceAsync(car, start, end, 'office', 'office')
    ).rejects.toThrow('db unavailable');

    expect(buildDefaultConfig).not.toHaveBeenCalled();
  });

  test('computes price when config loads', async () => {
    loadPricingConfig.mockResolvedValue(buildDefaultConfig());

    const result = await computeBookingPriceAsync(car, start, end, 'office', 'office');

    expect(result.totalPrice).toBeGreaterThan(0);
    expect(loadPricingConfig).toHaveBeenCalled();
  });
});
