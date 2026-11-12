/**
 * Admin walk-in order creation and car availability probe.
 * Create path locks the car, checks holds/rentals/overlaps, links a confirmed
 * reservation, writes the order, then adds the calendar range.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/orderSqlService' module as orderSql.
const orderSql = require('../../sql/orderSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  purgeExpired,
  // Contribute this line to the enclosing declaration or statement.
  addRange,
// Continue the surrounding logic with this statement.
} = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseOrderDateRange,
  // Contribute this line to the enclosing declaration or statement.
  validateOrderContact,
  // Contribute this line to the enclosing declaration or statement.
  computeOrderPricing,
// Continue the surrounding logic with this statement.
} = require('./orderDomainService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoBookedOverlap,
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  getAvailabilityConflicts,
// Continue the surrounding logic with this statement.
} = require('./orderConflictService');
// Destructure object properties into local variables.
const { buildOrderCreatePayload } = require('./orderMapper');
// Destructure object properties into local variables.
const { OrderFormError, runWithOptionalTransaction } = require('./orderShared');
// Destructure object properties into local variables.
const { buildOrderNewErrorResult } = require('./orderFormService');
// Destructure object properties into local variables.
const { ensureLinkedConfirmedReservation } = require('./orderReservationLinkService');
// Destructure object properties into local variables.
const { acquireCarAdvisoryLocks } = require('../../../db/transaction');

/**
 * AJAX availability check for the create-order form date picker.
 * @param {string|number} carId
 * @param {object} [query]
 */
async function getCarAvailability(carId, query = {}) {
  // Destructure object properties into local variables.
  const { pickupDate, pickupTime, returnDate, returnTime } = query;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId || !pickupDate || !returnDate) {
    // Return the resulting value to the caller.
    return {
      // Provide the status field value.
      status: 400,
      // Provide the body field value.
      body: { ok: false, error: 'Missing required parameters' },
    };
  }

  // Reserve the range variable for later assignment.
  let range;
  // Protected block: isolate failure modes.
  try {
    // Update range with the right-hand side value.
    range = parseOrderDateRange(pickupDate, pickupTime, returnDate, returnTime);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return {
      // Provide the status field value.
      status: 400,
      // Provide the body field value.
      body: { ok: false, error: 'Invalid date/time range' },
    };
  }

  // Create the conflicts constant.
  const conflicts = await getAvailabilityConflicts(carId, range.start, range.end);

  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: 200,
    // Provide the body field value.
    body: { ok: true, available: conflicts.length === 0, conflicts },
  };
}

/**
 * Validate and create an admin order; returns success or form error viewModel.
 * @param {object} payload
 */
async function createOrder(payload) {
  // Create the contact result constant.
  const contactResult = validateOrderContact(payload);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!contactResult.ok) {
    // Return the resulting value to the caller.
    return buildOrderNewErrorResult(payload, contactResult.message);
  }

  // Reserve the range variable for later assignment.
  let range;
  // Protected block: isolate failure modes.
  try {
    // Update range with the right-hand side value.
    range = parseOrderDateRange(
      // Contribute this line to the enclosing declaration or statement.
      payload.pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.pickupTime,
      // Contribute this line to the enclosing declaration or statement.
      payload.returnDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.returnTime
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.isOrderFormError) {
      // Return the resulting value to the caller.
      return buildOrderNewErrorResult(payload, err.message);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the command constant.
  const command = {
    // Provide the car id field value.
    carId: payload.carId,
    // Provide the pickup location field value.
    pickupLocation: payload.pickupLocation,
    // Provide the return location field value.
    returnLocation: payload.returnLocation,
    // Provide the pickup time field value.
    pickupTime: payload.pickupTime,
    // Provide the return time field value.
    returnTime: payload.returnTime,
    // Provide the hotel name field value.
    hotelName: payload.hotelName,
    // Provide the contact field value.
    contact: contactResult.contact,
  };

  // Protected block: isolate failure modes.
  try {
    // Create the order constant.
    const order = await runWithOptionalTransaction((client) =>
      // Call createOrderCore to perform this step.
      createOrderCore({
        // Contribute this line to the enclosing declaration or statement.
        command,
        // Contribute this line to the enclosing declaration or statement.
        range,
        // Contribute this line to the enclosing declaration or statement.
        client,
      })
    );
    // Return the resulting value to the caller.
    return { success: true, orderId: order?.id ?? null };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.isOrderFormError) {
      // Return the resulting value to the caller.
      return buildOrderNewErrorResult(payload, err.message);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Transactional create core: lock → conflict checks → price → reservation → order → range.
 * @param {{command: object, range: {start: Date, end: Date}, client: object}} args
 */
async function createOrderCore({ command, range, client }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!command.carId) {
    // Throw an error to stop the current control flow.
    throw new OrderFormError('CAR_REQUIRED', 'Car selection is required.');
  }

  // Advisory lock serializes concurrent admin creates for the same car.
  await acquireCarAdvisoryLocks(client, [command.carId]);
  // Wait until the asynchronous operation resolves.
  await purgeExpired(command.carId, client);
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(command.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Create the err constant.
    const err = new Error('Car not found');
    // Update err.code with the right-hand side value.
    err.code = 'CAR_NOT_FOUND';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Wait until the asynchronous operation resolves.
  await assertNoOpenPhysicalRental(command.carId, client);
  // Wait until the asynchronous operation resolves.
  await assertNoBookedOverlap(command.carId, range.start, range.end, client);
  // Wait until the asynchronous operation resolves.
  await assertNoActiveReservationHold(command.carId, range.start, range.end, client);

  // Create the pricing constant.
  const pricing = await computeOrderPricing(
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    range.start,
    // Contribute this line to the enclosing declaration or statement.
    range.end,
    // Contribute this line to the enclosing declaration or statement.
    command.pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    command.returnLocation,
    {
      // Provide the extras field value.
      extras: command.extras || command.selectedExtras || [],
      // Provide the hotel delivery field value.
      hotelDelivery: Boolean(command.hotelDelivery),
    }
  );

  // Create the order payload constant.
  const orderPayload = buildOrderCreatePayload({ command, range, pricing });

  // Create the reservation constant.
  const reservation = await ensureLinkedConfirmedReservation(
    {
      // Spread orderPayload into the surrounding structure.
      ...orderPayload,
      // Provide the car id field value.
      carId: command.carId,
    },
    // Contribute this line to the enclosing declaration or statement.
    { actor: { type: 'admin' }, client }
  );

  // Create the order constant.
  const order = await orderSql.createAdminOrder(
    // Contribute this line to the enclosing declaration or statement.
    { ...orderPayload, reservationId: reservation.id },
    // Reference the identifier used by the enclosing expression.
    client
  );
  // Wait until the asynchronous operation resolves.
  await addRange(command.carId, range.start, range.end, client);
  // Return the resulting value to the caller.
  return order;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createOrder,
  // Contribute this line to the enclosing declaration or statement.
  createOrderCore,
  // Contribute this line to the enclosing declaration or statement.
  getCarAvailability,
};
