/**
 * Keep linked order ↔ reservation fields in sync after calendar moves,
 * admin order edits, or reservation cancellation (soft-delete order).
 */
const orderSql = require('../../sql/orderSqlService');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Require the '../../../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { computeOrderPricing, applyOrderExpiryStatus } = require('./orderDomainService');
// Destructure object properties into local variables.
const { applyPricingToOrder } = require('./orderMapper');

/**
 * After a calendar move/resize updated reservation dates/car, sync the linked order
 * and return pricing to apply back onto the reservation.
 * Recomputes price so calendar drag does not leave stale totals on the order.
 */
async function syncLinkedOrderAfterReservationMove({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  start,
  // Contribute this line to the enclosing declaration or statement.
  end,
  // Contribute this line to the enclosing declaration or statement.
  pickupTime,
  // Contribute this line to the enclosing declaration or statement.
  returnTime,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras,
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery,
  // Update client with the right-hand side value.
  client = null,
// Continue the surrounding logic with this statement.
}) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Create the err constant.
    const err = new Error('Car not found');
    // Update err.code with the right-hand side value.
    err.code = 'CAR_NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the pricing constant.
  const pricing = await computeOrderPricing(
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    start,
    // Contribute this line to the enclosing declaration or statement.
    end,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    {
      // Provide the extras field value.
      extras: selectedExtras || [],
      // Provide the hotel delivery field value.
      hotelDelivery: Boolean(hotelDelivery),
    }
  );

  // Create the order constant.
  const order = await orderSql.findOrderByReservationId(reservationId, client);
  // Initialize the mutable order synced variable.
  let orderSynced = false;

  // Evaluate the condition and enter the branch when it is true.
  if (order) {
    // Update order.carId with the right-hand side value.
    order.carId = String(carId);
    // Update order.pickupDate with the right-hand side value.
    order.pickupDate = start;
    // Update order.returnDate with the right-hand side value.
    order.returnDate = end;
    // Update order.pickupTime with the right-hand side value.
    order.pickupTime = pickupTime || order.pickupTime;
    // Update order.returnTime with the right-hand side value.
    order.returnTime = returnTime || order.returnTime;
    // Update order.pickupLocation with the right-hand side value.
    order.pickupLocation = pickupLocation || order.pickupLocation;
    // Update order.returnLocation with the right-hand side value.
    order.returnLocation = returnLocation || order.returnLocation;
    // Call applyPricingToOrder to perform this step.
    applyPricingToOrder(order, pricing);
    // Call applyOrderExpiryStatus to perform this step.
    applyOrderExpiryStatus(order, end);
    // Wait until the asynchronous operation resolves.
    await orderSql.updateOrderFromDoc(order, client);
    // Update orderSynced with the right-hand side value.
    orderSynced = true;
  }

  // Return the resulting value to the caller.
  return { pricing, orderSynced, order };
}

/**
 * After an admin order update, push car/dates/contact/pricing onto the linked reservation
 * so calendar/ops stay consistent with the order + date blocks.
 */
async function syncLinkedReservationAfterOrderUpdate(order, { client = null } = {}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order?.reservationId) {
    // Return the resulting value to the caller.
    return { reservationSynced: false, reservation: null };
  }

  // Create the reservation constant.
  const reservation = await reservationRepository.findById(order.reservationId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Return the resulting value to the caller.
    return { reservationSynced: false, reservation: null };
  }

  // Update reservation.carId with the right-hand side value.
  reservation.carId = order.carId?.id || order.carId;
  // Update reservation.pickupDate with the right-hand side value.
  reservation.pickupDate = order.pickupDate;
  // Update reservation.returnDate with the right-hand side value.
  reservation.returnDate = order.returnDate;
  // Update reservation.pickupTime with the right-hand side value.
  reservation.pickupTime = order.pickupTime;
  // Update reservation.returnTime with the right-hand side value.
  reservation.returnTime = order.returnTime;
  // Update reservation.pickupLocation with the right-hand side value.
  reservation.pickupLocation = order.pickupLocation;
  // Update reservation.returnLocation with the right-hand side value.
  reservation.returnLocation = order.returnLocation;
  // Update reservation.fullName with the right-hand side value.
  reservation.fullName = order.fullName;
  // Update reservation.phoneNumber with the right-hand side value.
  reservation.phoneNumber = order.phoneNumber;
  // Update reservation.email with the right-hand side value.
  reservation.email = order.email;
  // Update reservation.address with the right-hand side value.
  reservation.address = order.address;
  // Update reservation.hotelName with the right-hand side value.
  reservation.hotelName = order.hotelName;
  // Update reservation.rentalDays with the right-hand side value.
  reservation.rentalDays = order.rentalDays;
  // Update reservation.deliveryPrice with the right-hand side value.
  reservation.deliveryPrice = order.deliveryPrice;
  // Update reservation.returnPrice with the right-hand side value.
  reservation.returnPrice = order.returnPrice;
  // Update reservation.totalPrice with the right-hand side value.
  reservation.totalPrice = order.totalPrice;
  // Update reservation.deposit with the right-hand side value.
  reservation.deposit = order.deposit;
  // Update reservation.priceSnapshot with the right-hand side value.
  reservation.priceSnapshot = order.priceSnapshot;
  // Update reservation.selectedExtras with the right-hand side value.
  reservation.selectedExtras = order.selectedExtras;
  // Update reservation.hotelDelivery with the right-hand side value.
  reservation.hotelDelivery = order.hotelDelivery;

  // Create the updated constant.
  const updated = await reservationRepository.update(reservation, client);
  // Return the resulting value to the caller.
  return { reservationSynced: true, reservation: updated };
}

/**
 * Soft-delete linked order for a cancelled/refunded reservation (removeRange already done by caller).
 * Also marks order status cancelled so it is not left "active".
 */
async function softDeleteOrderForReservation(reservationId, client = null) {
  // Create the order constant.
  const order = await orderSql.findOrderByReservationId(reservationId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order || order.isDeleted) {
    // Return the resulting value to the caller.
    return null;
  }
  // Update order.isDeleted with the right-hand side value.
  order.isDeleted = true;
  // Update order.deletedAt with the right-hand side value.
  order.deletedAt = new Date();
  // Update order.status with the right-hand side value.
  order.status = 'cancelled';
  // Wait until the asynchronous operation resolves.
  await orderSql.updateOrderFromDoc(order, client);
  // Return the resulting value to the caller.
  return order;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  syncLinkedOrderAfterReservationMove,
  // Contribute this line to the enclosing declaration or statement.
  syncLinkedReservationAfterOrderUpdate,
  // Contribute this line to the enclosing declaration or statement.
  softDeleteOrderForReservation,
};
