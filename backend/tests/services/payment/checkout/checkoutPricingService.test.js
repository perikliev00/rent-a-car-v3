// Call jest.mock to perform this step.
jest.mock('../../../../src/utils/pricing', () => ({
  // Provide the compute booking price async field value.
  computeBookingPriceAsync: jest.fn(),
}));

// Destructure object properties into local variables.
const { computeBookingPriceAsync } = require('../../../../src/utils/pricing');
// Destructure object properties into local variables.
const { resolveCheckoutPricing } = require('../../../../src/services/payment/checkout/checkoutPricingService');

// Declare a test suite grouping related cases.
describe('resolveCheckoutPricing', () => {
  // Create the car constant.
  const car = { id: 1, price: 45 };
  // Create the form data constant.
  const formData = { pickupLocation: 'office', returnLocation: 'office' };
  // Create the start date constant.
  const startDate = new Date('2026-08-01');
  // Create the end date constant.
  const endDate = new Date('2026-08-05');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('returns pricing when calculation succeeds', async () => {
    // Create the pricing constant.
    const pricing = { totalPrice: 180, rentalDays: 4 };
    // Call computeBookingPriceAsync.mockResolvedValue to perform this step.
    computeBookingPriceAsync.mockResolvedValue(pricing);

    // Wait until the asynchronous operation resolves.
    await expect(resolveCheckoutPricing(car, formData, startDate, endDate)).resolves.toEqual({
      // Provide the ok field value.
      ok: true,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });
  });

  // Define a single test case and its expectations.
  test('returns render response when pricing is invalid', async () => {
    // Call computeBookingPriceAsync.mockResolvedValue to perform this step.
    computeBookingPriceAsync.mockResolvedValue({ totalPrice: 0 });

    // Create the result constant.
    const result = await resolveCheckoutPricing(car, formData, startDate, endDate);

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.type).toBe('renderOrderPage');
  });

  // Define a single test case and its expectations.
  test('returns render response when pricing calculation throws', async () => {
    // Call computeBookingPriceAsync.mockRejectedValue to perform this step.
    computeBookingPriceAsync.mockRejectedValue(new Error('db unavailable'));

    // Create the result constant.
    const result = await resolveCheckoutPricing(car, formData, startDate, endDate);

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.response.type).toBe('renderOrderPage');
  });
});
