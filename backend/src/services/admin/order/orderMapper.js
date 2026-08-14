const { parseSofiaDate } = require('../../../utils/date/timezone');
const { toHHMM: normalizeToHHMM } = require('../../../utils/date/normalizeTime');

function toISODate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toHHMM(value) {
  return normalizeToHHMM(value) ?? '';
}

function resolveOrderDate(value, time, fallbackTime) {
  if (value instanceof Date) return value;
  return parseSofiaDate(value, time || fallbackTime);
}

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

function extractStoredRange(blocks, prevStart, prevEnd) {
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
