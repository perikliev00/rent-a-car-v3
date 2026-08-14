/**
 * Създава base booking payload за order page.
 * Дати, локации, pricing – без contact данни.
 */
function buildBaseOrderPayload({
  pickupDateISO,
  returnDateISO,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  pickupDateDisplay,
  returnDateDisplay,
  pickupLocationDisplay,
  returnLocationDisplay,
  pricing,
  releaseRedirect,
}) {
  return {
    pickupDateISO,
    returnDateISO,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pickupDateDisplay,
    returnDateDisplay,
    pickupLocationDisplay,
    returnLocationDisplay,
    rentalDays: pricing.rentalDays,
    deliveryPrice: pricing.deliveryPrice,
    returnPrice: pricing.returnPrice,
    totalPrice: pricing.totalPrice,
    deposit: pricing.deposit ?? 0,
    priceBreakdown: pricing.priceBreakdown || {
      lines: pricing.lines || [],
      totalPrice: pricing.totalPrice,
      deposit: pricing.deposit ?? 0,
      currency: 'EUR',
    },
    selectedExtras: pricing.snapshot?.selectedExtras || [],
    hotelDelivery: Boolean(pricing.snapshot?.hotelDelivery),
    releaseRedirect,
  };
}

/**
 * Създава пълен view model за order page.
 * car, basePayload, options (contact, existingReservation, message, title).
 */
function buildOrderViewModel(car, basePayload, options = {}) {
  const {
    contact = {},
    existingReservation = null,
    message = null,
    title = 'Order Car',
  } = options;

  return {
    title,
    car,
    pickupDate: basePayload.pickupDateDisplay,
    pickupTime: basePayload.pickupTime || '',
    returnDate: basePayload.returnDateDisplay,
    returnTime: basePayload.returnTime || '',
    pickupLocation: basePayload.pickupLocation,
    returnLocation: basePayload.returnLocation,
    pickupLocationDisplay: basePayload.pickupLocationDisplay,
    returnLocationDisplay: basePayload.returnLocationDisplay,
    pickupDateISO: basePayload.pickupDateISO,
    returnDateISO: basePayload.returnDateISO,
    rentalDays: basePayload.rentalDays,
    deliveryPrice: basePayload.deliveryPrice,
    returnPrice: basePayload.returnPrice,
    totalPrice: basePayload.totalPrice,
    deposit: basePayload.deposit ?? 0,
    priceBreakdown: basePayload.priceBreakdown || null,
    selectedExtras: basePayload.selectedExtras || [],
    hotelDelivery: Boolean(basePayload.hotelDelivery),
    fullName: contact.fullName || '',
    phoneNumber: contact.phoneNumber || '',
    email: contact.email || '',
    address: contact.address || '',
    hotelName: contact.hotelName || '',
    existingReservation,
    releaseRedirect: basePayload.releaseRedirect,
    message,
  };
}

module.exports = {
  buildBaseOrderPayload,
  buildOrderViewModel,
};
