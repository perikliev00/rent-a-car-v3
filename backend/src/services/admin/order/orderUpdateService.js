/**
 * Admin order update: contact-only fast path vs calendar move/updateRange/moveRange,
 * then sync the linked reservation so ops calendar stays consistent.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/orderSqlService' module as orderSql.
const orderSql = require('../../sql/orderSqlService');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../utils/date/timezone');
// Destructure object properties into local variables.
const { updateRange, moveRange } = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  CONTACT_REQUIRED_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  parseOrderDateRange,
  // Contribute this line to the enclosing declaration or statement.
  validateOrderContact,
  // Contribute this line to the enclosing declaration or statement.
  computeOrderPricing,
  // Contribute this line to the enclosing declaration or statement.
  applyOrderExpiryStatus,
  // Contribute this line to the enclosing declaration or statement.
  shouldRecalculateOrderPrice,
// Continue the surrounding logic with this statement.
} = require('./orderDomainService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_CONFLICT_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  resolveStoredDateRange,
// Continue the surrounding logic with this statement.
} = require('./orderConflictService');
// Destructure object properties into local variables.
const { applyPricingToOrder } = require('./orderMapper');
// Destructure object properties into local variables.
const { runWithOptionalTransaction } = require('./orderShared');
// Destructure object properties into local variables.
const { buildOrderEditErrorResult } = require('./orderFormService');
// Destructure object properties into local variables.
const { syncLinkedReservationAfterOrderUpdate } = require('./orderReservationSync');
// Destructure object properties into local variables.
const { acquireCarAdvisoryLocks } = require('../../../db/transaction');

/**
 * Validate and update an order; returns success+audit or edit error viewModel.
 * @param {number|string} orderId
 * @param {object} payload
 */
async function updateOrder(orderId, payload) {
  // Create the contact result constant.
  const contactResult = validateOrderContact(payload);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!contactResult.ok) {
    // Return the resulting value to the caller.
    return buildOrderEditErrorResult(
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Contribute this line to the enclosing declaration or statement.
      payload,
      // Contribute this line to the enclosing declaration or statement.
      contactResult.message
    );
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
      return buildOrderEditErrorResult(orderId, payload, err.message);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Protected block: isolate failure modes.
  try {
    // Create the audit constant.
    const audit = await runWithOptionalTransaction((client) =>
      // Call updateOrderCore to perform this step.
      updateOrderCore({
        // Contribute this line to the enclosing declaration or statement.
        orderId,
        // Contribute this line to the enclosing declaration or statement.
        payload,
        // Provide the contact field value.
        contact: contactResult.contact,
        // Contribute this line to the enclosing declaration or statement.
        range,
        // Contribute this line to the enclosing declaration or statement.
        client,
      })
    );
    // Return the resulting value to the caller.
    return { success: true, audit };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.isOrderFormError) {
      // Initialize the mutable message variable.
      let message = err.message || 'Error saving order';
      // Evaluate the condition and enter the branch when it is true.
      if (err.code === 'RESERVATION_CONFLICT') {
        // Update message with the right-hand side value.
        message = RESERVATION_CONFLICT_MESSAGE;
      // Continue the surrounding logic with this statement.
      } else if (err.code === 'OVERLAP') {
        // Update message with the right-hand side value.
        message =
          // Supply the literal value used by the enclosing expression.
          'Selected car is already booked in the specified period. Please choose different dates or a different car.';
      // Continue the surrounding logic with this statement.
      } else if (err.code === 'MISSING_CONTACT') {
        // Update message with the right-hand side value.
        message = CONTACT_REQUIRED_MESSAGE;
      }
      // Return the resulting value to the caller.
      return buildOrderEditErrorResult(orderId, payload, message);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/** Serialize a date-like value for audit payloads. */
function toIso(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) return value.toISOString();
  // Return the resulting value to the caller.
  return String(value);
}

/**
 * Transactional update core: lock both cars, adjust calendar ranges, sync reservation.
 * Uses stored date-block endpoints when removing the previous range so drifted
 * order fields still clear the correct booked block.
 * @param {{orderId: number|string, payload: object, contact: object, range: object, client: object}} args
 */
async function updateOrderCore({ orderId, payload, contact, range, client }) {
  // Create the existing order constant.
  const existingOrder = await orderSql.findOrderById(orderId, client);
  // Idempotency guard: return early when work was already applied.
  if (!existingOrder) {
    // Create the err constant.
    const err = new Error('Order not found');
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the prev car id constant.
  const prevCarId = existingOrder.carId;
  // Create the prev start constant.
  const prevStart =
    // Contribute this line to the enclosing declaration or statement.
    existingOrder.pickupDate instanceof Date
      // Contribute this line to the enclosing declaration or statement.
      ? existingOrder.pickupDate
      // Continue the surrounding logic with this statement.
      : parseSofiaDate(existingOrder.pickupDate, existingOrder.pickupTime || '00:00');
  // Create the prev end constant.
  const prevEnd =
    // Contribute this line to the enclosing declaration or statement.
    existingOrder.returnDate instanceof Date
      // Contribute this line to the enclosing declaration or statement.
      ? existingOrder.returnDate
      // Continue the surrounding logic with this statement.
      : parseSofiaDate(existingOrder.returnDate, existingOrder.returnTime || '23:59');

  // Create the new car id constant.
  const newCarId =
    // Contribute this line to the enclosing declaration or statement.
    payload.carId && payload.carId.toString
      // Continue the surrounding logic with this statement.
      ? payload.carId.toString()
      // Continue the surrounding logic with this statement.
      : String(prevCarId);

  // Lock prev + new car so concurrent edits cannot double-book either vehicle.
  await acquireCarAdvisoryLocks(client, [prevCarId, newCarId]);

  // Destructure object properties into local variables.
  const { storedStart, storedEnd } = await resolveStoredDateRange(
    // Contribute this line to the enclosing declaration or statement.
    prevCarId,
    // Contribute this line to the enclosing declaration or statement.
    prevStart,
    // Contribute this line to the enclosing declaration or statement.
    prevEnd,
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(newCarId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Create the err constant.
    const err = new Error('Car not found');
    // Update err.code with the right-hand side value.
    err.code = 'CAR_NOT_FOUND';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the same car constant.
  const sameCar = String(prevCarId) === String(newCarId);
  // Create the same start constant.
  const sameStart = prevStart && range.start && prevStart.getTime() === range.start.getTime();
  // Create the same end constant.
  const sameEnd = prevEnd && range.end && prevEnd.getTime() === range.end.getTime();
  // Create the recalculate price constant.
  const recalculatePrice = shouldRecalculateOrderPrice(
    // Contribute this line to the enclosing declaration or statement.
    existingOrder,
    // Contribute this line to the enclosing declaration or statement.
    payload,
    // Contribute this line to the enclosing declaration or statement.
    range,
    // Contribute this line to the enclosing declaration or statement.
    newCarId,
    // Reference the identifier used by the enclosing expression.
    prevCarId
  );
  // Create the moved constant.
  const moved = !sameCar || !sameStart || !sameEnd;

  // Create the audit constant.
  const audit = {
    // Contribute this line to the enclosing declaration or statement.
    moved,
    // Provide the car id field value.
    carId: String(newCarId),
    // Provide the previous car id field value.
    previousCarId: String(prevCarId),
    // Provide the from field value.
    from: toIso(range.start),
    // Provide the to field value.
    to: toIso(range.end),
    // Provide the previous from field value.
    previousFrom: toIso(prevStart),
    // Provide the previous to field value.
    previousTo: toIso(prevEnd),
    // Provide the price changed field value.
    priceChanged: Boolean(recalculatePrice),
  };

  // Guard: early-return or throw when required input is missing/invalid.
  if (!sameCar || !sameStart || !sameEnd) {
    // Wait until the asynchronous operation resolves.
    await assertNoActiveReservationHold(newCarId, range.start, range.end, client);
    // Wait until the asynchronous operation resolves.
    await assertNoOpenPhysicalRental(newCarId, client, {
      // Provide the exclude reservation id field value.
      excludeReservationId: existingOrder.reservationId,
    });
  }

  // Contact/location-only path: calendar range unchanged, skip updateRange/moveRange.
  if (sameCar && sameStart && sameEnd) {
    // Update existingOrder.pickupLocation with the right-hand side value.
    existingOrder.pickupLocation = payload.pickupLocation;
    // Update existingOrder.returnLocation with the right-hand side value.
    existingOrder.returnLocation = payload.returnLocation;
    // Update existingOrder.hotelName with the right-hand side value.
    existingOrder.hotelName = payload.hotelName;
    // Update existingOrder.fullName with the right-hand side value.
    existingOrder.fullName = contact.fullName;
    // Update existingOrder.phoneNumber with the right-hand side value.
    existingOrder.phoneNumber = contact.phoneNumber;
    // Update existingOrder.email with the right-hand side value.
    existingOrder.email = contact.email;
    // Update existingOrder.address with the right-hand side value.
    existingOrder.address = contact.address;

    // Evaluate the condition and enter the branch when it is true.
    if (recalculatePrice) {
      // Call applyPricingToOrder to perform this step.
      applyPricingToOrder(
        // Contribute this line to the enclosing declaration or statement.
        existingOrder,
        // Wait until the asynchronous operation resolves.
        await computeOrderPricing(
          // Contribute this line to the enclosing declaration or statement.
          car,
          // Contribute this line to the enclosing declaration or statement.
          prevStart,
          // Contribute this line to the enclosing declaration or statement.
          prevEnd,
          // Contribute this line to the enclosing declaration or statement.
          payload.pickupLocation,
          // Contribute this line to the enclosing declaration or statement.
          payload.returnLocation,
          {
            // Provide the extras field value.
            extras: payload.extras || payload.selectedExtras || [],
            // Provide the hotel delivery field value.
            hotelDelivery: Boolean(payload.hotelDelivery),
          }
        )
      );
    }

    // Wait until the asynchronous operation resolves.
    await orderSql.updateOrderFromDoc(existingOrder, client);
    // Wait until the asynchronous operation resolves.
    await syncLinkedReservationAfterOrderUpdate(existingOrder, { client });
    // Return the resulting value to the caller.
    return audit;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (String(newCarId) === String(prevCarId)) {
    // Wait until the asynchronous operation resolves.
    await updateRange(
      // Contribute this line to the enclosing declaration or statement.
      prevCarId,
      // Contribute this line to the enclosing declaration or statement.
      storedStart,
      // Contribute this line to the enclosing declaration or statement.
      storedEnd,
      // Contribute this line to the enclosing declaration or statement.
      range.start,
      // Contribute this line to the enclosing declaration or statement.
      range.end,
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Wait until the asynchronous operation resolves.
    await moveRange(
      // Contribute this line to the enclosing declaration or statement.
      prevCarId,
      // Contribute this line to the enclosing declaration or statement.
      newCarId,
      // Contribute this line to the enclosing declaration or statement.
      storedStart,
      // Contribute this line to the enclosing declaration or statement.
      storedEnd,
      // Contribute this line to the enclosing declaration or statement.
      range.start,
      // Contribute this line to the enclosing declaration or statement.
      range.end,
      // Reference the identifier used by the enclosing expression.
      client
    );
  }

  // Update existingOrder.carId with the right-hand side value.
  existingOrder.carId = newCarId;
  // Update existingOrder.pickupDate with the right-hand side value.
  existingOrder.pickupDate = range.start;
  // Update existingOrder.pickupTime with the right-hand side value.
  existingOrder.pickupTime = payload.pickupTime;
  // Update existingOrder.returnDate with the right-hand side value.
  existingOrder.returnDate = range.end;
  // Update existingOrder.returnTime with the right-hand side value.
  existingOrder.returnTime = payload.returnTime;
  // Update existingOrder.pickupLocation with the right-hand side value.
  existingOrder.pickupLocation = payload.pickupLocation;
  // Update existingOrder.returnLocation with the right-hand side value.
  existingOrder.returnLocation = payload.returnLocation;
  // Update existingOrder.hotelName with the right-hand side value.
  existingOrder.hotelName = payload.hotelName;
  // Update existingOrder.fullName with the right-hand side value.
  existingOrder.fullName = contact.fullName;
  // Update existingOrder.phoneNumber with the right-hand side value.
  existingOrder.phoneNumber = contact.phoneNumber;
  // Update existingOrder.email with the right-hand side value.
  existingOrder.email = contact.email;
  // Update existingOrder.address with the right-hand side value.
  existingOrder.address = contact.address;

  // Call applyOrderExpiryStatus to perform this step.
  applyOrderExpiryStatus(existingOrder, range.end);

  // Evaluate the condition and enter the branch when it is true.
  if (recalculatePrice) {
    // Call applyPricingToOrder to perform this step.
    applyPricingToOrder(
      // Contribute this line to the enclosing declaration or statement.
      existingOrder,
      // Wait until the asynchronous operation resolves.
      await computeOrderPricing(
        // Contribute this line to the enclosing declaration or statement.
        car,
        // Contribute this line to the enclosing declaration or statement.
        range.start,
        // Contribute this line to the enclosing declaration or statement.
        range.end,
        // Contribute this line to the enclosing declaration or statement.
        payload.pickupLocation,
        // Contribute this line to the enclosing declaration or statement.
        payload.returnLocation,
        {
          // Provide the extras field value.
          extras: payload.extras || payload.selectedExtras || [],
          // Provide the hotel delivery field value.
          hotelDelivery: Boolean(payload.hotelDelivery),
        }
      )
    );
  }

  // Wait until the asynchronous operation resolves.
  await orderSql.updateOrderFromDoc(existingOrder, client);
  // Wait until the asynchronous operation resolves.
  await syncLinkedReservationAfterOrderUpdate(existingOrder, { client });
  // Return the resulting value to the caller.
  return audit;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  updateOrder,
  // Contribute this line to the enclosing declaration or statement.
  updateOrderCore,
};
