/**
 * Pure helpers for admin order payloads: date/time formatting, create payload
 * assembly, in-place field application, and matching stored calendar blocks.
 */
const { parseSofiaDate } = require('../../../utils/date/timezone');
// Destructure object properties into local variables.
const { toHHMM: normalizeToHHMM } = require('../../../utils/date/normalizeTime');

/** Coerce a date-like value to YYYY-MM-DD (or empty string). */
function toISODate(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return '';
  // Evaluate the condition and enter the branch when it is true.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return String(value).slice(0, 10);
  // Create the d constant.
  const d = new Date(value);
  // Return the resulting value to the caller.
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Normalize a time-like value to HH:MM (or empty string). */
function toHHMM(value) {
  // Return the resulting value to the caller.
  return normalizeToHHMM(value) ?? '';
}

/**
 * Resolve an order date; Dates pass through, strings parse in Sofia timezone.
 * @param {Date|string} value
 * @param {string} [time]
 * @param {string} [fallbackTime]
 */
function resolveOrderDate(value, time, fallbackTime) {
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) return value;
  // Return the resulting value to the caller.
  return parseSofiaDate(value, time || fallbackTime);
}

/**
 * Build the SQL create payload from form command + computed range/pricing.
 * @param {{command: object, range: {start: Date, end: Date}, pricing: object}} args
 */
function buildOrderCreatePayload({ command, range, pricing }) {
  // Return the resulting value to the caller.
  return {
    // Provide the car id field value.
    carId: command.carId,
    // Provide the pickup date field value.
    pickupDate: range.start,
    // Provide the pickup time field value.
    pickupTime: command.pickupTime,
    // Provide the return date field value.
    returnDate: range.end,
    // Provide the return time field value.
    returnTime: command.returnTime,
    // Provide the pickup location field value.
    pickupLocation: command.pickupLocation,
    // Provide the return location field value.
    returnLocation: command.returnLocation,
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
    // Provide the price snapshot field value.
    priceSnapshot: pricing.snapshot || null,
    // Provide the selected extras field value.
    selectedExtras: pricing.snapshot?.selectedExtras || command.extras || [],
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(
      // Contribute this line to the enclosing declaration or statement.
      pricing.snapshot?.hotelDelivery || command.hotelDelivery
    ),
    // Provide the full name field value.
    fullName: command.contact.fullName,
    // Provide the phone number field value.
    phoneNumber: command.contact.phoneNumber,
    // Provide the email field value.
    email: command.contact.email,
    // Provide the address field value.
    address: command.contact.address,
    // Provide the hotel name field value.
    hotelName: command.hotelName,
  };
}

/**
 * Mutate order doc with schedule/location/contact/price fields from payload.
 * @param {object} order
 * @param {object} payload
 * @param {object} contact
 */
function applyPayloadToOrder(order, payload, contact) {
  // Update order.pickupDate with the right-hand side value.
  order.pickupDate = payload.pickupDate;
  // Update order.returnDate with the right-hand side value.
  order.returnDate = payload.returnDate;
  // Update order.pickupTime with the right-hand side value.
  order.pickupTime = payload.pickupTime;
  // Update order.returnTime with the right-hand side value.
  order.returnTime = payload.returnTime;
  // Update order.pickupLocation with the right-hand side value.
  order.pickupLocation = payload.pickupLocation;
  // Update order.returnLocation with the right-hand side value.
  order.returnLocation = payload.returnLocation;
  // Update order.hotelName with the right-hand side value.
  order.hotelName = payload.hotelName;
  // Update order.fullName with the right-hand side value.
  order.fullName = contact.fullName;
  // Update order.phoneNumber with the right-hand side value.
  order.phoneNumber = contact.phoneNumber;
  // Update order.email with the right-hand side value.
  order.email = contact.email;
  // Update order.address with the right-hand side value.
  order.address = contact.address;
  // Update order.rentalDays with the right-hand side value.
  order.rentalDays = payload.rentalDays;
  // Update order.deliveryPrice with the right-hand side value.
  order.deliveryPrice = payload.deliveryPrice;
  // Update order.returnPrice with the right-hand side value.
  order.returnPrice = payload.returnPrice;
  // Update order.totalPrice with the right-hand side value.
  order.totalPrice = payload.totalPrice;
  // Return the resulting value to the caller.
  return order;
}

/**
 * Mutate order doc with recomputed pricing fields and snapshot.
 * @param {object} order
 * @param {object} pricing
 */
function applyPricingToOrder(order, pricing) {
  // Update order.rentalDays with the right-hand side value.
  order.rentalDays = pricing.rentalDays;
  // Update order.deliveryPrice with the right-hand side value.
  order.deliveryPrice = pricing.deliveryPrice;
  // Update order.returnPrice with the right-hand side value.
  order.returnPrice = pricing.returnPrice;
  // Update order.totalPrice with the right-hand side value.
  order.totalPrice = pricing.totalPrice;
  // Update order.deposit with the right-hand side value.
  order.deposit = pricing.deposit ?? 0;
  // Update order.priceSnapshot with the right-hand side value.
  order.priceSnapshot = pricing.snapshot || null;
  // Update order.selectedExtras with the right-hand side value.
  order.selectedExtras = pricing.snapshot?.selectedExtras || order.selectedExtras || [];
  // Update order.hotelDelivery with the right-hand side value.
  order.hotelDelivery = Boolean(
    // Contribute this line to the enclosing declaration or statement.
    pricing.snapshot?.hotelDelivery ?? order.hotelDelivery
  );
  // Return the resulting value to the caller.
  return order;
}

/**
 * Find the calendar block overlapping the previous order range so update/restore
 * can remove the correct booked range even if stored endpoints drifted slightly.
 * @param {object[]} blocks
 * @param {Date} prevStart
 * @param {Date} prevEnd
 */
function extractStoredRange(blocks, prevStart, prevEnd) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Array.isArray(blocks) || !blocks.length) {
    // Return the resulting value to the caller.
    return { storedStart: prevStart, storedEnd: prevEnd };
  }

  // Create the candidate constant.
  const candidate = blocks.find((block) => {
    // Create the start constant.
    const start = new Date(block.startDate);
    // Create the end constant.
    const end = new Date(block.endDate);
    // Return the resulting value to the caller.
    return start < prevEnd && end > prevStart;
  });

  // Evaluate the condition and enter the branch when it is true.
  if (candidate) {
    // Return the resulting value to the caller.
    return {
      // Provide the stored start field value.
      storedStart: new Date(candidate.startDate),
      // Provide the stored end field value.
      storedEnd: new Date(candidate.endDate),
    };
  }

  // Return the resulting value to the caller.
  return { storedStart: prevStart, storedEnd: prevEnd };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  toISODate,
  // Contribute this line to the enclosing declaration or statement.
  toHHMM,
  // Contribute this line to the enclosing declaration or statement.
  resolveOrderDate,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderCreatePayload,
  // Contribute this line to the enclosing declaration or statement.
  applyPayloadToOrder,
  // Contribute this line to the enclosing declaration or statement.
  applyPricingToOrder,
  // Contribute this line to the enclosing declaration or statement.
  extractStoredRange,
};
