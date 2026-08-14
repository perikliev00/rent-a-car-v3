const { computeBookingPriceAsync } = require('../../../utils/pricing/calculateRentalPrice');
const { parseSofiaDate } = require('../../../utils/date/timezone');
const {
  trimContactDetails,
  contactFieldsIncomplete,
} = require('../../contactService');
const { OrderFormError } = require('./orderErrors');

const CONTACT_REQUIRED_MESSAGE =
  'Full name, phone number, email, and address are required.';

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

function validateOrderContact(payload) {
  const contact = trimContactDetails(payload);
  if (contactFieldsIncomplete(contact)) {
    return { ok: false, contact, message: CONTACT_REQUIRED_MESSAGE };
  }
  return { ok: true, contact };
}

async function computeOrderPricing(car, start, end, pickupLocation, returnLocation, options = {}) {
  return computeBookingPriceAsync(car, start, end, pickupLocation, returnLocation, options);
}

function applyOrderExpiryStatus(order, endDate, now = new Date()) {
  if (endDate <= now) {
    order.status = 'expired';
    if (!order.expiredAt) {
      order.expiredAt = now;
    }
  } else {
    order.status = 'active';
    order.expiredAt = undefined;
  }
  return order;
}

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
