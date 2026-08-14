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
  getAvailabilityConflicts,
} = require('./orderConflictService');
const { buildOrderCreatePayload } = require('./orderMapper');
const { OrderFormError, runWithOptionalTransaction } = require('./orderShared');
const { buildOrderNewErrorResult } = require('./orderFormService');
const { ensureLinkedConfirmedReservation } = require('./orderReservationLinkService');

async function getCarAvailability(carId, query = {}) {
  const { pickupDate, pickupTime, returnDate, returnTime } = query;

  if (!carId || !pickupDate || !returnDate) {
    return {
      status: 400,
      body: { ok: false, error: 'Missing required parameters' },
    };
  }

  let range;
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

async function createOrder(payload) {
  const contactResult = validateOrderContact(payload);
  if (!contactResult.ok) {
    return buildOrderNewErrorResult(payload, contactResult.message);
  }

  let range;
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

async function createOrderCore({ command, range, client }) {
  if (!command.carId) {
    throw new OrderFormError('CAR_REQUIRED', 'Car selection is required.');
  }

  await purgeExpired(command.carId, client);
  const car = await carRepository.findByIdForAdmin(command.carId);
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }

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
