// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/pricingConfigSqlService', () => ({
  // Provide the load pricing config field value.
  loadPricingConfig: jest.fn(),
  // Provide the build default config field value.
  buildDefaultConfig: jest.fn(() => ({
    // Provide the seasons field value.
    seasons: [],
    // Provide the weekend rules field value.
    weekendRules: [],
    // Provide the discount rules field value.
    discountRules: [],
    // Provide the deposit rules field value.
    depositRules: [{ id: 0, name: 'Default deposit', defaultAmount: 300, active: true }],
    // Provide the delivery fees field value.
    deliveryFees: [],
    // Provide the delivery fee map field value.
    deliveryFeeMap: {},
    // Provide the global fees field value.
    globalFees: [],
    // Provide the extras field value.
    extras: [],
  })),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/utils/logger', () => ({
  // Provide the error field value.
  error: jest.fn(),
  // Provide the info field value.
  info: jest.fn(),
  // Provide the warn field value.
  warn: jest.fn(),
}));

// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  loadPricingConfig,
  // Contribute this line to the enclosing declaration or statement.
  buildDefaultConfig,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/sql/pricingConfigSqlService');
// Destructure object properties into local variables.
const { computeBookingPriceAsync } = require('../../../src/utils/pricing/calculateRentalPrice');

// Declare a test suite grouping related cases.
describe('computeBookingPriceAsync', () => {
  // Create the car constant.
  const car = { price: 50, priceTier_1_3: 60, priceTier_7_31: 45, priceTier_31_plus: 35 };
  // Create the start constant.
  const start = new Date('2026-07-01T10:00:00Z');
  // Create the end constant.
  const end = new Date('2026-07-03T10:00:00Z');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('rejects when pricing config cannot be loaded (fail closed)', async () => {
    // Create the err constant.
    const err = new Error('db unavailable');
    // Call loadPricingConfig.mockRejectedValue to perform this step.
    loadPricingConfig.mockRejectedValue(err);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call computeBookingPriceAsync to perform this step.
      computeBookingPriceAsync(car, start, end, 'office', 'office')
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow('db unavailable');

    // Assert that the value matches the intended expectation.
    expect(buildDefaultConfig).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('computes price when config loads', async () => {
    // Call loadPricingConfig.mockResolvedValue to perform this step.
    loadPricingConfig.mockResolvedValue(buildDefaultConfig());

    // Create the result constant.
    const result = await computeBookingPriceAsync(car, start, end, 'office', 'office');

    // Assert that the value matches the intended expectation.
    expect(result.totalPrice).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(loadPricingConfig).toHaveBeenCalled();
  });
});
