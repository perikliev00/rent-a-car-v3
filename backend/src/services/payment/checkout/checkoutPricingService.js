/**
 * Resolve booking price for the checkout flow (extras, delivery, late return, etc.).
 * Returns a renderable error response when pricing cannot be computed or is invalid.
 */
const { computeBookingPriceAsync } = require('../../../utils/pricing');
// Destructure object properties into local variables.
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
  // Create the extras constant.
  const extras = Array.isArray(formData.extras)
    // Contribute this line to the enclosing declaration or statement.
    ? formData.extras
    // Continue the surrounding logic with this statement.
    : typeof formData.extras === 'string' && formData.extras
      // Continue the surrounding logic with this statement.
      ? formData.extras.split(',').map((s) => s.trim()).filter(Boolean)
      // Contribute this line to the enclosing declaration or statement.
      : [];

  // Create the unable to price constant.
  const unableToPrice = () => ({
    // Provide the ok field value.
    ok: false,
    // Provide the response field value.
    response: buildRenderOrderPageResponse(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      formData,
      // Supply the literal value used by the enclosing expression.
      'Unable to calculate price for this rental. Please try again.',
      {}
    ),
  });

  // Reserve the pricing variable for later assignment.
  let pricing;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in pricing.
    pricing = await computeBookingPriceAsync(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      formData.pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      formData.returnLocation,
      {
        // Contribute this line to the enclosing declaration or statement.
        extras,
        // Provide the hotel delivery field value.
        hotelDelivery: Boolean(formData.hotelDelivery) || Boolean(formData.hotelName),
        // Provide the late return field value.
        lateReturn: Boolean(formData.lateReturn),
        // Provide the fuel fee field value.
        fuelFee: Boolean(formData.fuelFee),
        // Provide the booked at field value.
        bookedAt: new Date(),
      }
    );
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return unableToPrice();
  }

  // Guard against zero/NaN totals before creating a Stripe charge.
  if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
    // Return the resulting value to the caller.
    return unableToPrice();
  }

  // Return the resulting value to the caller.
  return { ok: true, pricing };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveCheckoutPricing,
};
