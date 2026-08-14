const reservationRepository = require('../../../repositories/reservationRepository');
const { recordInitialStatus } = require('../../reservation/reservationStatusService');

/**
 * Ensure an order has a linked reservation at confirmed (ops dashboard coverage).
 */
async function ensureLinkedConfirmedReservation(order, { actor = { type: 'admin' }, client = null } = {}) {
  if (!order) {
    return null;
  }

  if (order.reservationId) {
    const existing = await reservationRepository.findById(order.reservationId, client);
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
