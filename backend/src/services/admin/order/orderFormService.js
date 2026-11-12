/**
 * View-model builders for admin order create/edit forms and validation error pages.
 */
const orderSql = require('../../sql/orderSqlService');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Destructure object properties into local variables.
const { toISODate, toHHMM, applyPayloadToOrder } = require('./orderMapper');

/** Default blank create-form values (today / office / 10:00). */
function buildInitialOrderDefaults() {
  // Create the now constant.
  const now = new Date();
  // Create the today constant.
  const today = now.toISOString().slice(0, 10);
  // Return the resulting value to the caller.
  return {
    // Provide the pickup date field value.
    pickupDate: today,
    // Provide the return date field value.
    returnDate: today,
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return time field value.
    returnTime: '10:00',
    // Provide the pickup location field value.
    pickupLocation: 'office',
    // Provide the return location field value.
    returnLocation: 'office',
    // Provide the rental days field value.
    rentalDays: 1,
    // Provide the delivery price field value.
    deliveryPrice: 0,
    // Provide the return price field value.
    returnPrice: 0,
    // Provide the total price field value.
    totalPrice: 0,
    // Provide the hotel name field value.
    hotelName: '',
    // Provide the full name field value.
    fullName: '',
    // Provide the phone number field value.
    phoneNumber: '',
    // Provide the email field value.
    email: '',
    // Provide the address field value.
    address: '',
  };
}

/** Re-hydrate form defaults from a failed submit payload so fields are not lost. */
function buildOrderFormDefaultsFromPayload(payload = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the pickup date field value.
    pickupDate: payload.pickupDate || '',
    // Provide the return date field value.
    returnDate: payload.returnDate || '',
    // Provide the pickup time field value.
    pickupTime: payload.pickupTime || '',
    // Provide the return time field value.
    returnTime: payload.returnTime || '',
    // Provide the pickup location field value.
    pickupLocation: payload.pickupLocation || 'office',
    // Provide the return location field value.
    returnLocation: payload.returnLocation || 'office',
    // Provide the rental days field value.
    rentalDays:
      // Continue the surrounding logic with this statement.
      payload.rentalDays !== undefined && payload.rentalDays !== ''
        // Contribute this line to the enclosing declaration or statement.
        ? payload.rentalDays
        // Contribute this line to the enclosing declaration or statement.
        : 1,
    // Provide the delivery price field value.
    deliveryPrice:
      // Continue the surrounding logic with this statement.
      payload.deliveryPrice !== undefined && payload.deliveryPrice !== ''
        // Contribute this line to the enclosing declaration or statement.
        ? payload.deliveryPrice
        // Contribute this line to the enclosing declaration or statement.
        : 0,
    // Provide the return price field value.
    returnPrice:
      // Continue the surrounding logic with this statement.
      payload.returnPrice !== undefined && payload.returnPrice !== ''
        // Contribute this line to the enclosing declaration or statement.
        ? payload.returnPrice
        // Contribute this line to the enclosing declaration or statement.
        : 0,
    // Provide the total price field value.
    totalPrice:
      // Continue the surrounding logic with this statement.
      payload.totalPrice !== undefined && payload.totalPrice !== ''
        // Contribute this line to the enclosing declaration or statement.
        ? payload.totalPrice
        // Contribute this line to the enclosing declaration or statement.
        : 0,
    // Provide the full name field value.
    fullName: payload.fullName || '',
    // Provide the phone number field value.
    phoneNumber: payload.phoneNumber || '',
    // Provide the email field value.
    email: payload.email || '',
    // Provide the address field value.
    address: payload.address || '',
    // Provide the hotel name field value.
    hotelName: payload.hotelName || '',
  };
}

/**
 * Load cars list.
 * @returns {Promise<*>}
 */
async function getCarsList() {
  // Return the resulting value to the caller.
  return carRepository.listAll();
}

/**
 * 422 create-form error viewModel with submitted defaults + car list.
 * @param {object} payload
 * @param {string} errorMessage
 */
async function buildOrderNewErrorResult(payload, errorMessage) {
  // Create the cars constant.
  const cars = await getCarsList();
  // Return the resulting value to the caller.
  return {
    // Provide the success field value.
    success: false,
    // Provide the status field value.
    status: 422,
    // Provide the view model field value.
    viewModel: {
      // Provide the error field value.
      error: errorMessage,
      // Provide the defaults field value.
      defaults: buildOrderFormDefaultsFromPayload(payload),
      // Contribute this line to the enclosing declaration or statement.
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
  // Create the order constant.
  const order = await orderSql.findOrderByIdPopulated(orderId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    // Create the err constant.
    const err = new Error('Order not found');
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Call applyPayloadToOrder to perform this step.
  applyPayloadToOrder(order, payload, {
    // Provide the full name field value.
    fullName: payload.fullName,
    // Provide the phone number field value.
    phoneNumber: payload.phoneNumber,
    // Provide the email field value.
    email: payload.email,
    // Provide the address field value.
    address: payload.address,
  });

  // Create the cars constant.
  const cars = await getCarsList();

  // Return the resulting value to the caller.
  return {
    // Provide the success field value.
    success: false,
    // Provide the status field value.
    status: 422,
    // Provide the view model field value.
    viewModel: {
      // Provide the error field value.
      error: errorMessage,
      // Contribute this line to the enclosing declaration or statement.
      order,
      // Contribute this line to the enclosing declaration or statement.
      cars,
      // Provide the pickup date iso field value.
      pickupDateISO: toISODate(order.pickupDate),
      // Provide the return date iso field value.
      returnDateISO: toISODate(order.returnDate),
      // Provide the pickup time hhmm field value.
      pickupTimeHHMM: toHHMM(order.pickupTime),
      // Provide the return time hhmm field value.
      returnTimeHHMM: toHHMM(order.returnTime),
    },
  };
}

/** Initial create-order page data. */
async function getCreateOrderForm() {
  // Create the cars constant.
  const cars = await getCarsList();
  // Return the resulting value to the caller.
  return {
    // Provide the defaults field value.
    defaults: buildInitialOrderDefaults(),
    // Contribute this line to the enclosing declaration or statement.
    cars,
  };
}

/**
 * Edit page data with ISO/HH:MM display helpers for date inputs.
 * @param {number|string} id
 */
async function getOrderEditData(id) {
  // Create the order constant.
  const order = await orderSql.findOrderByIdPopulated(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    // Return the resulting value to the caller.
    return null;
  }
  // Create the cars constant.
  const cars = await getCarsList();
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    order,
    // Contribute this line to the enclosing declaration or statement.
    cars,
    // Provide the pickup date iso field value.
    pickupDateISO: toISODate(order.pickupDate),
    // Provide the return date iso field value.
    returnDateISO: toISODate(order.returnDate),
    // Provide the pickup time hhmm field value.
    pickupTimeHHMM: toHHMM(order.pickupTime),
    // Provide the return time hhmm field value.
    returnTimeHHMM: toHHMM(order.returnTime),
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildInitialOrderDefaults,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderFormDefaultsFromPayload,
  // Contribute this line to the enclosing declaration or statement.
  getCarsList,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderNewErrorResult,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderEditErrorResult,
  // Contribute this line to the enclosing declaration or statement.
  toISODate,
  // Contribute this line to the enclosing declaration or statement.
  toHHMM,
  // Contribute this line to the enclosing declaration or statement.
  getCreateOrderForm,
  // Contribute this line to the enclosing declaration or statement.
  getOrderEditData,
};
