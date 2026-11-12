/**
 * Domain helpers for admin orders: date parsing, contact validation, pricing,
 * expiry status, and deciding when an edit must recalculate price.
 */
const { computeBookingPriceAsync } = require('../../../utils/pricing/calculateRentalPrice');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../utils/date/timezone');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  trimContactDetails,
  // Contribute this line to the enclosing declaration or statement.
  contactFieldsIncomplete,
// Continue the surrounding logic with this statement.
} = require('../../contactService');
// Destructure object properties into local variables.
const { OrderFormError } = require('./orderErrors');

// Create the contact required message constant.
const CONTACT_REQUIRED_MESSAGE =
  // Supply the literal value used by the enclosing expression.
  'Full name, phone number, email, and address are required.';

/**
 * Parse pickup/return into Sofia-local Date bounds; rejects empty or inverted ranges.
 * @param {string} pickupDate
 * @param {string} pickupTime
 * @param {string} returnDate
 * @param {string} returnTime
 * @returns {{start: Date, end: Date}}
 */
function parseOrderDateRange(pickupDate, pickupTime, returnDate, returnTime) {
  // Create the start constant.
  const start = parseSofiaDate(pickupDate, pickupTime || '00:00');
  // Create the end constant.
  const end = parseSofiaDate(returnDate, returnTime || '23:59');

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Contribute this line to the enclosing declaration or statement.
    !start ||
    // Contribute this line to the enclosing declaration or statement.
    !end ||
    // Call Number.isNaN to perform this step.
    Number.isNaN(start.getTime()) ||
    // Call Number.isNaN to perform this step.
    Number.isNaN(end.getTime()) ||
    // Continue the surrounding logic with this statement.
    start >= end
  // Continue the surrounding logic with this statement.
  ) {
    // Throw an error to stop the current control flow.
    throw new OrderFormError('INVALID_RANGE', 'Invalid pick-up/return range');
  }

  // Return the resulting value to the caller.
  return { start, end };
}

/**
 * Trim and validate required contact fields for order create/update.
 * @param {object} payload
 * @returns {{ok: boolean, contact: object, message?: string}}
 */
function validateOrderContact(payload) {
  // Create the contact constant.
  const contact = trimContactDetails(payload);
  // Evaluate the condition and enter the branch when it is true.
  if (contactFieldsIncomplete(contact)) {
    // Return the resulting value to the caller.
    return { ok: false, contact, message: CONTACT_REQUIRED_MESSAGE };
  }
  // Return the resulting value to the caller.
  return { ok: true, contact };
}

/** Delegate to shared booking price calculator (same rules as online checkout). */
async function computeOrderPricing(car, start, end, pickupLocation, returnLocation, options = {}) {
  // Return the resulting value to the caller.
  return computeBookingPriceAsync(car, start, end, pickupLocation, returnLocation, options);
}

/**
 * Mark order active vs expired based on return end vs now.
 * Preserves an existing expiredAt timestamp on re-save of already-expired orders.
 * @param {object} order
 * @param {Date} endDate
 * @param {Date} [now]
 */
function applyOrderExpiryStatus(order, endDate, now = new Date()) {
  // Evaluate the condition and enter the branch when it is true.
  if (endDate <= now) {
    // Update order.status with the right-hand side value.
    order.status = 'expired';
    // Guard: early-return or throw when required input is missing/invalid.
    if (!order.expiredAt) {
      // Update order.expiredAt with the right-hand side value.
      order.expiredAt = now;
    }
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Update order.status with the right-hand side value.
    order.status = 'active';
    // Update order.expiredAt with the right-hand side value.
    order.expiredAt = undefined;
  }
  // Return the resulting value to the caller.
  return order;
}

/**
 * True when car, dates, locations, hotel delivery, or extras changed vs existing order.
 * Avoids unnecessary price recomputation on contact-only edits.
 * @param {object} existingOrder
 * @param {object} payload
 * @param {{start: Date, end: Date}} range
 * @param {string|number} newCarId
 * @param {string|number} prevCarId
 */
function shouldRecalculateOrderPrice(existingOrder, payload, range, newCarId, prevCarId) {
  // Create the prev start constant.
  const prevStart =
    // Contribute this line to the enclosing declaration or statement.
    existingOrder.pickupDate instanceof Date
      // Contribute this line to the enclosing declaration or statement.
      ? existingOrder.pickupDate
      // Continue the surrounding logic with this statement.
      : parseSofiaDate(existingOrder.pickupDate, existingOrder.pickupTime || '00:00');
  // Create the prev end constant.
  const prevEnd =
    // Contribute this line to the enclosing declaration or statement.
    existingOrder.returnDate instanceof Date
      // Contribute this line to the enclosing declaration or statement.
      ? existingOrder.returnDate
      // Continue the surrounding logic with this statement.
      : parseSofiaDate(existingOrder.returnDate, existingOrder.returnTime || '23:59');

  // Create the same car constant.
  const sameCar = String(prevCarId) === String(newCarId);
  // Create the same start constant.
  const sameStart = prevStart && range.start && prevStart.getTime() === range.start.getTime();
  // Create the same end constant.
  const sameEnd = prevEnd && range.end && prevEnd.getTime() === range.end.getTime();
  // Create the same pickup loc constant.
  const samePickupLoc = existingOrder.pickupLocation === payload.pickupLocation;
  // Create the same return loc constant.
  const sameReturnLoc = existingOrder.returnLocation === payload.returnLocation;
  // Create the same hotel constant.
  const sameHotel =
    // Call Boolean to perform this step.
    Boolean(existingOrder.hotelDelivery) === Boolean(payload.hotelDelivery);
  // Create the prev extras constant.
  const prevExtras = JSON.stringify(existingOrder.selectedExtras || []);
  // Create the next extras constant.
  const nextExtras = JSON.stringify(payload.extras || payload.selectedExtras || []);

  // Return control to the caller with the following value.
  return (
    // Contribute this line to the enclosing declaration or statement.
    !sameCar ||
    // Contribute this line to the enclosing declaration or statement.
    !sameStart ||
    // Contribute this line to the enclosing declaration or statement.
    !sameEnd ||
    // Contribute this line to the enclosing declaration or statement.
    !samePickupLoc ||
    // Contribute this line to the enclosing declaration or statement.
    !sameReturnLoc ||
    // Contribute this line to the enclosing declaration or statement.
    !sameHotel ||
    // Continue the surrounding logic with this statement.
    prevExtras !== nextExtras
  );
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CONTACT_REQUIRED_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  parseOrderDateRange,
  // Contribute this line to the enclosing declaration or statement.
  validateOrderContact,
  // Contribute this line to the enclosing declaration or statement.
  computeOrderPricing,
  // Contribute this line to the enclosing declaration or statement.
  applyOrderExpiryStatus,
  // Contribute this line to the enclosing declaration or statement.
  shouldRecalculateOrderPrice,
};
