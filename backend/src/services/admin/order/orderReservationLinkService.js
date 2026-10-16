/**
 * Ensure walk-in / admin-created orders appear on the ops dashboard by linking
 * (or creating) a confirmed reservation for the order.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
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
    return null;
  }

  if (order.reservationId) {
    const existing = await reservationRepository.findById(order.reservationId, client);
    // Idempotency guard: return early when work was already applied.
    if (existing) {
      return existing;
    }
  }

  const reservation = await reservationRepository.createConfirmed(
    {
      carId: order.carId?.id || order.carId,
      sessionId: `admin-order-${order.id || 'new'}-${Date.now()}`,
      pickupDate: order.pickupDate,
      pickupTime: order.pickupTime,
      returnDate: order.returnDate,
      returnTime: order.returnTime,
      pickupLocation: order.pickupLocation,
      returnLocation: order.returnLocation,
      rentalDays: order.rentalDays,
      deliveryPrice: order.deliveryPrice,
      returnPrice: order.returnPrice,
      totalPrice: order.totalPrice,
      deposit: order.deposit,
      priceSnapshot: order.priceSnapshot,
      selectedExtras: order.selectedExtras,
      hotelDelivery: order.hotelDelivery,
      fullName: order.fullName,
      phoneNumber: order.phoneNumber,
      email: order.email,
      address: order.address,
      hotelName: order.hotelName,
      holdExpiresAt: new Date(),
    },
    client
  );

  await recordInitialStatus({
    reservationId: reservation.id,
    status: 'confirmed',
    reason: 'admin_order_link',
    actor,
    client,
  });

  return reservation;
}

module.exports = {
  ensureLinkedConfirmedReservation,
};
