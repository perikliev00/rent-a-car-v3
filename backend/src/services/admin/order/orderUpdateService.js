const carRepository = require('../../../repositories/carRepository');
const orderSql = require('../../sql/orderSqlService');
const { parseSofiaDate } = require('../../../utils/date/timezone');
const { updateRange, moveRange } = require('../../sql/bookingSyncSqlService');
const {
  CONTACT_REQUIRED_MESSAGE,
  parseOrderDateRange,
  validateOrderContact,
  computeOrderPricing,
  applyOrderExpiryStatus,
  shouldRecalculateOrderPrice,
} = require('./orderDomainService');
const {
  RESERVATION_CONFLICT_MESSAGE,
  assertNoActiveReservationHold,
  resolveStoredDateRange,
} = require('./orderConflictService');
const { applyPricingToOrder } = require('./orderMapper');
const { runWithOptionalTransaction } = require('./orderShared');
const { buildOrderEditErrorResult } = require('./orderFormService');
const { syncLinkedReservationAfterOrderUpdate } = require('./orderReservationSync');

async function updateOrder(orderId, payload) {
  const contactResult = validateOrderContact(payload);
  if (!contactResult.ok) {
    return buildOrderEditErrorResult(
      orderId,
      payload,
      contactResult.message
    );
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
      return buildOrderEditErrorResult(orderId, payload, err.message);
    }
    throw err;
  }

  try {
    const audit = await runWithOptionalTransaction((client) =>
      updateOrderCore({
        orderId,
        payload,
        contact: contactResult.contact,
        range,
        client,
      })
    );
    return { success: true, audit };
  } catch (err) {
    if (err.isOrderFormError) {
      let message = err.message || 'Error saving order';
      if (err.code === 'RESERVATION_CONFLICT') {
        message = RESERVATION_CONFLICT_MESSAGE;
      } else if (err.code === 'OVERLAP') {
        message =
          'Selected car is already booked in the specified period. Please choose different dates or a different car.';
      } else if (err.code === 'MISSING_CONTACT') {
        message = CONTACT_REQUIRED_MESSAGE;
      }
      return buildOrderEditErrorResult(orderId, payload, message);
    }
    throw err;
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function updateOrderCore({ orderId, payload, contact, range, client }) {
  const existingOrder = await orderSql.findOrderById(orderId, client);
  if (!existingOrder) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const prevCarId = existingOrder.carId;
  const prevStart =
    existingOrder.pickupDate instanceof Date
      ? existingOrder.pickupDate
      : parseSofiaDate(existingOrder.pickupDate, existingOrder.pickupTime || '00:00');
  const prevEnd =
    existingOrder.returnDate instanceof Date
      ? existingOrder.returnDate
      : parseSofiaDate(existingOrder.returnDate, existingOrder.returnTime || '23:59');

  const { storedStart, storedEnd } = await resolveStoredDateRange(
    prevCarId,
    prevStart,
    prevEnd,
    client
  );

  const newCarId =
    payload.carId && payload.carId.toString
      ? payload.carId.toString()
      : String(prevCarId);

  const car = await carRepository.findByIdForAdmin(newCarId);
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }

  const sameCar = String(prevCarId) === String(newCarId);
  const sameStart = prevStart && range.start && prevStart.getTime() === range.start.getTime();
  const sameEnd = prevEnd && range.end && prevEnd.getTime() === range.end.getTime();
  const recalculatePrice = shouldRecalculateOrderPrice(
    existingOrder,
    payload,
    range,
    newCarId,
    prevCarId
  );
  const moved = !sameCar || !sameStart || !sameEnd;

  const audit = {
    moved,
    carId: String(newCarId),
    previousCarId: String(prevCarId),
    from: toIso(range.start),
    to: toIso(range.end),
    previousFrom: toIso(prevStart),
    previousTo: toIso(prevEnd),
    priceChanged: Boolean(recalculatePrice),
  };

  if (!sameCar || !sameStart || !sameEnd) {
    await assertNoActiveReservationHold(newCarId, range.start, range.end, client);
  }

  if (sameCar && sameStart && sameEnd) {
    existingOrder.pickupLocation = payload.pickupLocation;
    existingOrder.returnLocation = payload.returnLocation;
    existingOrder.hotelName = payload.hotelName;
    existingOrder.fullName = contact.fullName;
    existingOrder.phoneNumber = contact.phoneNumber;
    existingOrder.email = contact.email;
    existingOrder.address = contact.address;

    if (recalculatePrice) {
      applyPricingToOrder(
        existingOrder,
        await computeOrderPricing(
          car,
          prevStart,
          prevEnd,
          payload.pickupLocation,
          payload.returnLocation,
          {
            extras: payload.extras || payload.selectedExtras || [],
            hotelDelivery: Boolean(payload.hotelDelivery),
          }
        )
      );
    }

    await orderSql.updateOrderFromDoc(existingOrder, client);
    await syncLinkedReservationAfterOrderUpdate(existingOrder, { client });
    return audit;
  }

  if (String(newCarId) === String(prevCarId)) {
    await updateRange(
      prevCarId,
      storedStart,
      storedEnd,
      range.start,
      range.end,
      client
    );
  } else {
    await moveRange(
      prevCarId,
      newCarId,
      storedStart,
      storedEnd,
      range.start,
      range.end,
      client
    );
  }

  existingOrder.carId = newCarId;
  existingOrder.pickupDate = range.start;
  existingOrder.pickupTime = payload.pickupTime;
  existingOrder.returnDate = range.end;
  existingOrder.returnTime = payload.returnTime;
  existingOrder.pickupLocation = payload.pickupLocation;
  existingOrder.returnLocation = payload.returnLocation;
  existingOrder.hotelName = payload.hotelName;
  existingOrder.fullName = contact.fullName;
  existingOrder.phoneNumber = contact.phoneNumber;
  existingOrder.email = contact.email;
  existingOrder.address = contact.address;

  applyOrderExpiryStatus(existingOrder, range.end);

  if (recalculatePrice) {
    applyPricingToOrder(
      existingOrder,
      await computeOrderPricing(
        car,
        range.start,
        range.end,
        payload.pickupLocation,
        payload.returnLocation,
        {
          extras: payload.extras || payload.selectedExtras || [],
          hotelDelivery: Boolean(payload.hotelDelivery),
        }
      )
    );
  }

  await orderSql.updateOrderFromDoc(existingOrder, client);
  await syncLinkedReservationAfterOrderUpdate(existingOrder, { client });
  return audit;
}

module.exports = {
  updateOrder,
  updateOrderCore,
};
