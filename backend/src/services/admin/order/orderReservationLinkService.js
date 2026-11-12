/**
 * Ensure walk-in / admin-created orders appear on the ops dashboard by linking
 * (or creating) a confirmed reservation for the order.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { recordInitialStatus } = require('../../reservation/reservationStatusService');

/**
 * Ensure an order has a linked reservation at confirmed (ops dashboard coverage).
 * Reuses an existing link when present; otherwise creates a confirmed reservation
 * with a synthetic sessionId so it never collides with online checkout sessions.
 * @param {object} order
 * @param {{actor?: object, client?: object|null}} [opts]
 */
async function ensureLinkedConfirmedReservation(order, { actor = { type: 'admin' }, client = null } = {}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    // Return the resulting value to the caller.
    return null;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (order.reservationId) {
    // Create the existing constant.
    const existing = await reservationRepository.findById(order.reservationId, client);
    // Idempotency guard: return early when work was already applied.
    if (existing) {
      // Return the resulting value to the caller.
      return existing;
    }
  }

  // Create the reservation constant.
  const reservation = await reservationRepository.createConfirmed(
    {
      // Provide the car id field value.
      carId: order.carId?.id || order.carId,
      // Provide the session id field value.
      sessionId: `admin-order-${order.id || 'new'}-${Date.now()}`,
      // Provide the pickup date field value.
      pickupDate: order.pickupDate,
      // Provide the pickup time field value.
      pickupTime: order.pickupTime,
      // Provide the return date field value.
      returnDate: order.returnDate,
      // Provide the return time field value.
      returnTime: order.returnTime,
      // Provide the pickup location field value.
      pickupLocation: order.pickupLocation,
      // Provide the return location field value.
      returnLocation: order.returnLocation,
      // Provide the rental days field value.
      rentalDays: order.rentalDays,
      // Provide the delivery price field value.
      deliveryPrice: order.deliveryPrice,
      // Provide the return price field value.
      returnPrice: order.returnPrice,
      // Provide the total price field value.
      totalPrice: order.totalPrice,
      // Provide the deposit field value.
      deposit: order.deposit,
      // Provide the price snapshot field value.
      priceSnapshot: order.priceSnapshot,
      // Provide the selected extras field value.
      selectedExtras: order.selectedExtras,
      // Provide the hotel delivery field value.
      hotelDelivery: order.hotelDelivery,
      // Provide the full name field value.
      fullName: order.fullName,
      // Provide the phone number field value.
      phoneNumber: order.phoneNumber,
      // Provide the email field value.
      email: order.email,
      // Provide the address field value.
      address: order.address,
      // Provide the hotel name field value.
      hotelName: order.hotelName,
      // Provide the hold expires at field value.
      holdExpiresAt: new Date(),
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Wait until the asynchronous operation resolves.
  await recordInitialStatus({
    // Provide the reservation id field value.
    reservationId: reservation.id,
    // Provide the status field value.
    status: 'confirmed',
    // Provide the reason field value.
    reason: 'admin_order_link',
    // Contribute this line to the enclosing declaration or statement.
    actor,
    // Contribute this line to the enclosing declaration or statement.
    client,
  });

  // Return the resulting value to the caller.
  return reservation;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ensureLinkedConfirmedReservation,
};
