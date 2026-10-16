/**
 * Pure helpers for admin order payloads: date/time formatting, create payload
 * assembly, in-place field application, and matching stored calendar blocks.
 */
const { parseSofiaDate } = require('../../../utils/date/timezone');
const { toHHMM: normalizeToHHMM } = require('../../../utils/date/normalizeTime');

/** Coerce a date-like value to YYYY-MM-DD (or empty string). */
function toISODate(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Normalize a time-like value to HH:MM (or empty string). */
function toHHMM(value) {
  return normalizeToHHMM(value) ?? '';
}

/**
 * Resolve an order date; Dates pass through, strings parse in Sofia timezone.
 * @param {Date|string} value
 * @param {string} [time]
 * @param {string} [fallbackTime]
 */
function resolveOrderDate(value, time, fallbackTime) {
  if (value instanceof Date) return value;
  return parseSofiaDate(value, time || fallbackTime);
}

/**
 * Build the SQL create payload from form command + computed range/pricing.
 * @param {{command: object, range: {start: Date, end: Date}, pricing: object}} args
 */
function buildOrderCreatePayload({ command, range, pricing }) {
  return {
    carId: command.carId,
    pickupDate: range.start,
    pickupTime: command.pickupTime,
    returnDate: range.end,
    returnTime: command.returnTime,
    pickupLocation: command.pickupLocation,
    returnLocation: command.returnLocation,
    rentalDays: pricing.rentalDays,
    deliveryPrice: pricing.deliveryPrice,
    returnPrice: pricing.returnPrice,
    totalPrice: pricing.totalPrice,
    deposit: pricing.deposit ?? 0,
    priceSnapshot: pricing.snapshot || null,
    selectedExtras: pricing.snapshot?.selectedExtras || command.extras || [],
    hotelDelivery: Boolean(
      pricing.snapshot?.hotelDelivery || command.hotelDelivery
    ),
    fullName: command.contact.fullName,
    phoneNumber: command.contact.phoneNumber,
    email: command.contact.email,
    address: command.contact.address,
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
  order.pickupDate = payload.pickupDate;
  order.returnDate = payload.returnDate;
  order.pickupTime = payload.pickupTime;
  order.returnTime = payload.returnTime;
  order.pickupLocation = payload.pickupLocation;
  order.returnLocation = payload.returnLocation;
  order.hotelName = payload.hotelName;
  order.fullName = contact.fullName;
  order.phoneNumber = contact.phoneNumber;
  order.email = contact.email;
  order.address = contact.address;
  order.rentalDays = payload.rentalDays;
  order.deliveryPrice = payload.deliveryPrice;
  order.returnPrice = payload.returnPrice;
  order.totalPrice = payload.totalPrice;
  return order;
}

/**
 * Mutate order doc with recomputed pricing fields and snapshot.
 * @param {object} order
 * @param {object} pricing
 */
function applyPricingToOrder(order, pricing) {
  order.rentalDays = pricing.rentalDays;
  order.deliveryPrice = pricing.deliveryPrice;
  order.returnPrice = pricing.returnPrice;
  order.totalPrice = pricing.totalPrice;
  order.deposit = pricing.deposit ?? 0;
  order.priceSnapshot = pricing.snapshot || null;
  order.selectedExtras = pricing.snapshot?.selectedExtras || order.selectedExtras || [];
  order.hotelDelivery = Boolean(
    pricing.snapshot?.hotelDelivery ?? order.hotelDelivery
  );
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
    return { storedStart: prevStart, storedEnd: prevEnd };
  }

  const candidate = blocks.find((block) => {
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);
    return start < prevEnd && end > prevStart;
  });

  if (candidate) {
    return {
      storedStart: new Date(candidate.startDate),
      storedEnd: new Date(candidate.endDate),
    };
  }

  return { storedStart: prevStart, storedEnd: prevEnd };
}

module.exports = {
  toISODate,
  toHHMM,
  resolveOrderDate,
  buildOrderCreatePayload,
  applyPayloadToOrder,
  applyPricingToOrder,
  extractStoredRange,
};
