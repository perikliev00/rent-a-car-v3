/**
 * Build order-page view models (dates, locations, pricing) for server-rendered checkout.
 */

/**
 * Create the base booking payload for the order page (no contact fields).
 * @param {object} params
 * @returns {object}
 */
function buildBaseOrderPayload({
  // Contribute this line to the enclosing declaration or statement.
  pickupDateISO,
  // Contribute this line to the enclosing declaration or statement.
  returnDateISO,
  // Contribute this line to the enclosing declaration or statement.
  pickupTime,
  // Contribute this line to the enclosing declaration or statement.
  returnTime,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Contribute this line to the enclosing declaration or statement.
  pickupDateDisplay,
  // Contribute this line to the enclosing declaration or statement.
  returnDateDisplay,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocationDisplay,
  // Contribute this line to the enclosing declaration or statement.
  returnLocationDisplay,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Contribute this line to the enclosing declaration or statement.
  releaseRedirect,
// Continue the surrounding logic with this statement.
}) {
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    pickupDateISO,
    // Contribute this line to the enclosing declaration or statement.
    returnDateISO,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    pickupDateDisplay,
    // Contribute this line to the enclosing declaration or statement.
    returnDateDisplay,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocationDisplay,
    // Contribute this line to the enclosing declaration or statement.
    returnLocationDisplay,
    // Provide the rental days field value.
    rentalDays: pricing.rentalDays,
    // Provide the delivery price field value.
    deliveryPrice: pricing.deliveryPrice,
    // Provide the return price field value.
    returnPrice: pricing.returnPrice,
    // Provide the total price field value.
    totalPrice: pricing.totalPrice,
    // Provide the deposit field value.
    deposit: pricing.deposit ?? 0,
    // Provide the price breakdown field value.
    priceBreakdown: pricing.priceBreakdown || {
      // Provide the lines field value.
      lines: pricing.lines || [],
      // Provide the total price field value.
      totalPrice: pricing.totalPrice,
      // Provide the deposit field value.
      deposit: pricing.deposit ?? 0,
      // Provide the currency field value.
      currency: 'EUR',
    },
    // Provide the selected extras field value.
    selectedExtras: pricing.snapshot?.selectedExtras || [],
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(pricing.snapshot?.hotelDelivery),
    // Contribute this line to the enclosing declaration or statement.
    releaseRedirect,
  };
}

/**
 * Create the full order-page view model (car + base payload + contact/message options).
 * @param {object} car
 * @param {object} basePayload
 * @param {object} [options]
 * @returns {object}
 */
function buildOrderViewModel(car, basePayload, options = {}) {
  // Destructure object properties into local variables.
  const {
    // Update contact with the right-hand side value.
    contact = {},
    // Update existingReservation with the right-hand side value.
    existingReservation = null,
    // Update message with the right-hand side value.
    message = null,
    // Update title with the right-hand side value.
    title = 'Order Car',
  // Continue the surrounding logic with this statement.
  } = options;

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    title,
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Provide the pickup date field value.
    pickupDate: basePayload.pickupDateDisplay,
    // Provide the pickup time field value.
    pickupTime: basePayload.pickupTime || '',
    // Provide the return date field value.
    returnDate: basePayload.returnDateDisplay,
    // Provide the return time field value.
    returnTime: basePayload.returnTime || '',
    // Provide the pickup location field value.
    pickupLocation: basePayload.pickupLocation,
    // Provide the return location field value.
    returnLocation: basePayload.returnLocation,
    // Provide the pickup location display field value.
    pickupLocationDisplay: basePayload.pickupLocationDisplay,
    // Provide the return location display field value.
    returnLocationDisplay: basePayload.returnLocationDisplay,
    // Provide the pickup date iso field value.
    pickupDateISO: basePayload.pickupDateISO,
    // Provide the return date iso field value.
    returnDateISO: basePayload.returnDateISO,
    // Provide the rental days field value.
    rentalDays: basePayload.rentalDays,
    // Provide the delivery price field value.
    deliveryPrice: basePayload.deliveryPrice,
    // Provide the return price field value.
    returnPrice: basePayload.returnPrice,
    // Provide the total price field value.
    totalPrice: basePayload.totalPrice,
    // Provide the deposit field value.
    deposit: basePayload.deposit ?? 0,
    // Provide the price breakdown field value.
    priceBreakdown: basePayload.priceBreakdown || null,
    // Provide the selected extras field value.
    selectedExtras: basePayload.selectedExtras || [],
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(basePayload.hotelDelivery),
    // Provide the full name field value.
    fullName: contact.fullName || '',
    // Provide the phone number field value.
    phoneNumber: contact.phoneNumber || '',
    // Provide the email field value.
    email: contact.email || '',
    // Provide the address field value.
    address: contact.address || '',
    // Provide the hotel name field value.
    hotelName: contact.hotelName || '',
    // Contribute this line to the enclosing declaration or statement.
    existingReservation,
    // Provide the release redirect field value.
    releaseRedirect: basePayload.releaseRedirect,
    // Contribute this line to the enclosing declaration or statement.
    message,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildBaseOrderPayload,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderViewModel,
};
