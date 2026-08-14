const { computeBookingPriceAsync } = require('../../../utils/pricing');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

async function resolveCheckoutPricing(car, formData, startDate, endDate) {
  const extras = Array.isArray(formData.extras)
    ? formData.extras
    : typeof formData.extras === 'string' && formData.extras
      ? formData.extras.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const unableToPrice = () => ({
    ok: false,
    response: buildRenderOrderPageResponse(
      car,
      formData,
      'Unable to calculate price for this rental. Please try again.',
      {}
    ),
  });

  let pricing;
  try {
    pricing = await computeBookingPriceAsync(
      car,
      startDate,
      endDate,
      formData.pickupLocation,
      formData.returnLocation,
      {
        extras,
        hotelDelivery: Boolean(formData.hotelDelivery) || Boolean(formData.hotelName),
        lateReturn: Boolean(formData.lateReturn),
        fuelFee: Boolean(formData.fuelFee),
        bookedAt: new Date(),
      }
    );
  } catch {
    return unableToPrice();
  }

  if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
    return unableToPrice();
  }

  return { ok: true, pricing };
}

module.exports = {
  resolveCheckoutPricing,
};
