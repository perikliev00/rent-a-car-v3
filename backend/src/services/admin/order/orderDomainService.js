/**
 * Domain helpers for admin orders: date parsing, contact validation, pricing,
 * expiry status, and deciding when an edit must recalculate price.
 */
const { computeBookingPriceAsync } = require('../../../utils/pricing/calculateRentalPrice');
const { parseSofiaDate } = require('../../../utils/date/timezone');
const {
  trimContactDetails,
  contactFieldsIncomplete,
} = require('../../contactService');
const { OrderFormError } = require('./orderErrors');

const CONTACT_REQUIRED_MESSAGE =
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
  const start = parseSofiaDate(pickupDate, pickupTime || '00:00');
  const end = parseSofiaDate(returnDate, returnTime || '23:59');

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    throw new OrderFormError('INVALID_RANGE', 'Invalid pick-up/return range');
  }

  return { start, end };
}

/**
 * Trim and validate required contact fields for order create/update.
 * @param {object} payload
 * @returns {{ok: boolean, contact: object, message?: string}}
 */
function validateOrderContact(payload) {
  const contact = trimContactDetails(payload);
  if (contactFieldsIncomplete(contact)) {
    return { ok: false, contact, message: CONTACT_REQUIRED_MESSAGE };
  }
  return { ok: true, contact };
}

/** Delegate to shared booking price calculator (same rules as online checkout). */
async function computeOrderPricing(car, start, end, pickupLocation, returnLocation, options = {}) {
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
  if (endDate <= now) {
    order.status = 'expired';
    // Guard: early-return or throw when required input is missing/invalid.
    if (!order.expiredAt) {
      order.expiredAt = now;
    }
  } else {
    order.status = 'active';
    order.expiredAt = undefined;
  }
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
  const prevStart =
    existingOrder.pickupDate instanceof Date
      ? existingOrder.pickupDate
      : parseSofiaDate(existingOrder.pickupDate, existingOrder.pickupTime || '00:00');
  const prevEnd =
    existingOrder.returnDate instanceof Date
      ? existingOrder.returnDate
      : parseSofiaDate(existingOrder.returnDate, existingOrder.returnTime || '23:59');

  const sameCar = String(prevCarId) === String(newCarId);
  const sameStart = prevStart && range.start && prevStart.getTime() === range.start.getTime();
  const sameEnd = prevEnd && range.end && prevEnd.getTime() === range.end.getTime();
  const samePickupLoc = existingOrder.pickupLocation === payload.pickupLocation;
  const sameReturnLoc = existingOrder.returnLocation === payload.returnLocation;
  const sameHotel =
    Boolean(existingOrder.hotelDelivery) === Boolean(payload.hotelDelivery);
  const prevExtras = JSON.stringify(existingOrder.selectedExtras || []);
  const nextExtras = JSON.stringify(payload.extras || payload.selectedExtras || []);

  return (
    !sameCar ||
    !sameStart ||
    !sameEnd ||
    !samePickupLoc ||
    !sameReturnLoc ||
    !sameHotel ||
    prevExtras !== nextExtras
  );
}

module.exports = {
  CONTACT_REQUIRED_MESSAGE,
  parseOrderDateRange,
  validateOrderContact,
  computeOrderPricing,
  applyOrderExpiryStatus,
  shouldRecalculateOrderPrice,
};
