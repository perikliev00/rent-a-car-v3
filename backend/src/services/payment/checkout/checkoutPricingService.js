/**
 * Resolve booking price for the checkout flow (extras, delivery, late return, etc.).
 * Returns a renderable error response when pricing cannot be computed or is invalid.
 */
const { computeBookingPriceAsync } = require('../../../utils/pricing');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

/**
 * Compute checkout pricing from car, form data, and date range.
 *
 * @param {object} car
 * @param {object} formData
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{ ok: true, pricing: object } | { ok: false, response: object }>}
 */
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
  // Protected block: isolate failure modes.
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

  // Guard against zero/NaN totals before creating a Stripe charge.
  if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
    return unableToPrice();
  }

  return { ok: true, pricing };
}

module.exports = {
  resolveCheckoutPricing,
};
