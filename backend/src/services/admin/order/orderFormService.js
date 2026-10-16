/**
 * View-model builders for admin order create/edit forms and validation error pages.
 */
const orderSql = require('../../sql/orderSqlService');
const carRepository = require('../../../repositories/carRepository');
const { toISODate, toHHMM, applyPayloadToOrder } = require('./orderMapper');

/** Default blank create-form values (today / office / 10:00). */
function buildInitialOrderDefaults() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    pickupDate: today,
    returnDate: today,
    pickupTime: '10:00',
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    rentalDays: 1,
    deliveryPrice: 0,
    returnPrice: 0,
    totalPrice: 0,
    hotelName: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
  };
}

/** Re-hydrate form defaults from a failed submit payload so fields are not lost. */
function buildOrderFormDefaultsFromPayload(payload = {}) {
  return {
    pickupDate: payload.pickupDate || '',
    returnDate: payload.returnDate || '',
    pickupTime: payload.pickupTime || '',
    returnTime: payload.returnTime || '',
    pickupLocation: payload.pickupLocation || 'office',
    returnLocation: payload.returnLocation || 'office',
    rentalDays:
      payload.rentalDays !== undefined && payload.rentalDays !== ''
        ? payload.rentalDays
        : 1,
    deliveryPrice:
      payload.deliveryPrice !== undefined && payload.deliveryPrice !== ''
        ? payload.deliveryPrice
        : 0,
    returnPrice:
      payload.returnPrice !== undefined && payload.returnPrice !== ''
        ? payload.returnPrice
        : 0,
    totalPrice:
      payload.totalPrice !== undefined && payload.totalPrice !== ''
        ? payload.totalPrice
        : 0,
    fullName: payload.fullName || '',
    phoneNumber: payload.phoneNumber || '',
    email: payload.email || '',
    address: payload.address || '',
    hotelName: payload.hotelName || '',
  };
}

/**
 * Load cars list.
 * @returns {Promise<*>}
 */
async function getCarsList() {
  return carRepository.listAll();
}

/**
 * 422 create-form error viewModel with submitted defaults + car list.
 * @param {object} payload
 * @param {string} errorMessage
 */
async function buildOrderNewErrorResult(payload, errorMessage) {
  const cars = await getCarsList();
  return {
    success: false,
    status: 422,
    viewModel: {
      error: errorMessage,
      defaults: buildOrderFormDefaultsFromPayload(payload),
      cars,
    },
  };
}

/**
 * 422 edit-form error viewModel; overlays payload onto the existing order for redisplay.
 * @param {number|string} orderId
 * @param {object} payload
 * @param {string} errorMessage
 */
async function buildOrderEditErrorResult(orderId, payload, errorMessage) {
  const order = await orderSql.findOrderByIdPopulated(orderId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  applyPayloadToOrder(order, payload, {
    fullName: payload.fullName,
    phoneNumber: payload.phoneNumber,
    email: payload.email,
    address: payload.address,
  });

  const cars = await getCarsList();

  return {
    success: false,
    status: 422,
    viewModel: {
      error: errorMessage,
      order,
      cars,
      pickupDateISO: toISODate(order.pickupDate),
      returnDateISO: toISODate(order.returnDate),
      pickupTimeHHMM: toHHMM(order.pickupTime),
      returnTimeHHMM: toHHMM(order.returnTime),
    },
  };
}

/** Initial create-order page data. */
async function getCreateOrderForm() {
  const cars = await getCarsList();
  return {
    defaults: buildInitialOrderDefaults(),
    cars,
  };
}

/**
 * Edit page data with ISO/HH:MM display helpers for date inputs.
 * @param {number|string} id
 */
async function getOrderEditData(id) {
  const order = await orderSql.findOrderByIdPopulated(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    return null;
  }
  const cars = await getCarsList();
  return {
    order,
    cars,
    pickupDateISO: toISODate(order.pickupDate),
    returnDateISO: toISODate(order.returnDate),
    pickupTimeHHMM: toHHMM(order.pickupTime),
    returnTimeHHMM: toHHMM(order.returnTime),
  };
}

module.exports = {
  buildInitialOrderDefaults,
  buildOrderFormDefaultsFromPayload,
  getCarsList,
  buildOrderNewErrorResult,
  buildOrderEditErrorResult,
  toISODate,
  toHHMM,
  getCreateOrderForm,
  getOrderEditData,
};
