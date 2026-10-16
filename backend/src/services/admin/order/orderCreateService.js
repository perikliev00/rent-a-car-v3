/**
 * Admin walk-in order creation and car availability probe.
 * Create path locks the car, checks holds/rentals/overlaps, links a confirmed
 * reservation, writes the order, then adds the calendar range.
 */
const carRepository = require('../../../repositories/carRepository');
const orderSql = require('../../sql/orderSqlService');
const {
  purgeExpired,
  addRange,
} = require('../../sql/bookingSyncSqlService');
const {
  parseOrderDateRange,
  validateOrderContact,
  computeOrderPricing,
} = require('./orderDomainService');
const {
  assertNoBookedOverlap,
  assertNoActiveReservationHold,
  assertNoOpenPhysicalRental,
  getAvailabilityConflicts,
} = require('./orderConflictService');
const { buildOrderCreatePayload } = require('./orderMapper');
const { OrderFormError, runWithOptionalTransaction } = require('./orderShared');
const { buildOrderNewErrorResult } = require('./orderFormService');
const { ensureLinkedConfirmedReservation } = require('./orderReservationLinkService');
const { acquireCarAdvisoryLocks } = require('../../../db/transaction');

/**
 * AJAX availability check for the create-order form date picker.
 * @param {string|number} carId
 * @param {object} [query]
 */
async function getCarAvailability(carId, query = {}) {
  const { pickupDate, pickupTime, returnDate, returnTime } = query;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId || !pickupDate || !returnDate) {
    return {
      status: 400,
      body: { ok: false, error: 'Missing required parameters' },
    };
  }

  let range;
  // Protected block: isolate failure modes.
  try {
    range = parseOrderDateRange(pickupDate, pickupTime, returnDate, returnTime);
  } catch {
    return {
      status: 400,
      body: { ok: false, error: 'Invalid date/time range' },
    };
  }

  const conflicts = await getAvailabilityConflicts(carId, range.start, range.end);

  return {
    status: 200,
    body: { ok: true, available: conflicts.length === 0, conflicts },
  };
}

/**
 * Validate and create an admin order; returns success or form error viewModel.
 * @param {object} payload
 */
async function createOrder(payload) {
  const contactResult = validateOrderContact(payload);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!contactResult.ok) {
    return buildOrderNewErrorResult(payload, contactResult.message);
  }

  let range;
  // Protected block: isolate failure modes.
  try {
    range = parseOrderDateRange(
      payload.pickupDate,
      payload.pickupTime,
      payload.returnDate,
      payload.returnTime
    );
  } catch (err) {
    if (err.isOrderFormError) {
      return buildOrderNewErrorResult(payload, err.message);
    }
    throw err;
  }

  const command = {
    carId: payload.carId,
    pickupLocation: payload.pickupLocation,
    returnLocation: payload.returnLocation,
    pickupTime: payload.pickupTime,
    returnTime: payload.returnTime,
    hotelName: payload.hotelName,
    contact: contactResult.contact,
  };

  // Protected block: isolate failure modes.
  try {
    const order = await runWithOptionalTransaction((client) =>
      createOrderCore({
        command,
        range,
        client,
      })
    );
    return { success: true, orderId: order?.id ?? null };
  } catch (err) {
    if (err.isOrderFormError) {
      return buildOrderNewErrorResult(payload, err.message);
    }
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
    throw new OrderFormError('CAR_REQUIRED', 'Car selection is required.');
  }

  // Advisory lock serializes concurrent admin creates for the same car.
  await acquireCarAdvisoryLocks(client, [command.carId]);
  await purgeExpired(command.carId, client);
  const car = await carRepository.findByIdForAdmin(command.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }

  await assertNoOpenPhysicalRental(command.carId, client);
  await assertNoBookedOverlap(command.carId, range.start, range.end, client);
  await assertNoActiveReservationHold(command.carId, range.start, range.end, client);

  const pricing = await computeOrderPricing(
    car,
    range.start,
    range.end,
    command.pickupLocation,
    command.returnLocation,
    {
      extras: command.extras || command.selectedExtras || [],
      hotelDelivery: Boolean(command.hotelDelivery),
    }
  );

  const orderPayload = buildOrderCreatePayload({ command, range, pricing });

  const reservation = await ensureLinkedConfirmedReservation(
    {
      ...orderPayload,
      carId: command.carId,
    },
    { actor: { type: 'admin' }, client }
  );

  const order = await orderSql.createAdminOrder(
    { ...orderPayload, reservationId: reservation.id },
    client
  );
  await addRange(command.carId, range.start, range.end, client);
  return order;
}

module.exports = {
  createOrder,
  createOrderCore,
  getCarAvailability,
};
