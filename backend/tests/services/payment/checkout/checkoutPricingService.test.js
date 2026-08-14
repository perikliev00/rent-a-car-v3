jest.mock('../../../../src/utils/pricing', () => ({
  computeBookingPriceAsync: jest.fn(),
}));

const { computeBookingPriceAsync } = require('../../../../src/utils/pricing');
const { resolveCheckoutPricing } = require('../../../../src/services/payment/checkout/checkoutPricingService');

describe('resolveCheckoutPricing', () => {
  const car = { id: 1, price: 45 };
  const formData = { pickupLocation: 'office', returnLocation: 'office' };
  const startDate = new Date('2026-08-01');
  const endDate = new Date('2026-08-05');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns pricing when calculation succeeds', async () => {
    const pricing = { totalPrice: 180, rentalDays: 4 };
    computeBookingPriceAsync.mockResolvedValue(pricing);

    await expect(resolveCheckoutPricing(car, formData, startDate, endDate)).resolves.toEqual({
      ok: true,
      pricing,
    });
  });

  test('returns render response when pricing is invalid', async () => {
    computeBookingPriceAsync.mockResolvedValue({ totalPrice: 0 });

    const result = await resolveCheckoutPricing(car, formData, startDate, endDate);

    expect(result.ok).toBe(false);
    expect(result.response.type).toBe('renderOrderPage');
  });

  test('returns render response when pricing calculation throws', async () => {
    computeBookingPriceAsync.mockRejectedValue(new Error('db unavailable'));

    const result = await resolveCheckoutPricing(car, formData, startDate, endDate);

    expect(result.ok).toBe(false);
    expect(result.response.type).toBe('renderOrderPage');
  });
});
