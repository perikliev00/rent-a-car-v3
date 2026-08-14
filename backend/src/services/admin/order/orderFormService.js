const orderSql = require('../../sql/orderSqlService');
const carRepository = require('../../../repositories/carRepository');
const { toISODate, toHHMM, applyPayloadToOrder } = require('./orderMapper');

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

async function getCarsList() {
  return carRepository.listAll();
}

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

async function buildOrderEditErrorResult(orderId, payload, errorMessage) {
  const order = await orderSql.findOrderByIdPopulated(orderId);
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

async function getCreateOrderForm() {
  const cars = await getCarsList();
  return {
    defaults: buildInitialOrderDefaults(),
    cars,
  };
}

async function getOrderEditData(id) {
  const order = await orderSql.findOrderByIdPopulated(id);
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
