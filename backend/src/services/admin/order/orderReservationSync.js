const orderSql = require('../../sql/orderSqlService');
const carRepository = require('../../../repositories/carRepository');
const reservationRepository = require('../../../repositories/reservationRepository');
const { computeOrderPricing, applyOrderExpiryStatus } = require('./orderDomainService');
const { applyPricingToOrder } = require('./orderMapper');

/**
 * After a calendar move/resize updated reservation dates/car, sync the linked order
 * and return pricing to apply back onto the reservation.
 */
async function syncLinkedOrderAfterReservationMove({
  reservationId,
  carId,
  start,
  end,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  selectedExtras,
  hotelDelivery,
  client = null,
}) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const pricing = await computeOrderPricing(
    car,
    start,
    end,
    pickupLocation,
    returnLocation,
    {
      extras: selectedExtras || [],
      hotelDelivery: Boolean(hotelDelivery),
    }
  );

  const order = await orderSql.findOrderByReservationId(reservationId, client);
  let orderSynced = false;

  if (order) {
    order.carId = String(carId);
    order.pickupDate = start;
    order.returnDate = end;
    order.pickupTime = pickupTime || order.pickupTime;
    order.returnTime = returnTime || order.returnTime;
    order.pickupLocation = pickupLocation || order.pickupLocation;
    order.returnLocation = returnLocation || order.returnLocation;
    applyPricingToOrder(order, pricing);
    applyOrderExpiryStatus(order, end);
    await orderSql.updateOrderFromDoc(order, client);
    orderSynced = true;
  }

  return { pricing, orderSynced, order };
}

/**
 * After an admin order update, push car/dates/contact/pricing onto the linked reservation
 * so calendar/ops stay consistent with the order + date blocks.
 */
async function syncLinkedReservationAfterOrderUpdate(order, { client = null } = {}) {
  if (!order?.reservationId) {
    return { reservationSynced: false, reservation: null };
  }

  const reservation = await reservationRepository.findById(order.reservationId, client);
  if (!reservation) {
    return { reservationSynced: false, reservation: null };
  }

  reservation.carId = order.carId?.id || order.carId;
  reservation.pickupDate = order.pickupDate;
  reservation.returnDate = order.returnDate;
  reservation.pickupTime = order.pickupTime;
  reservation.returnTime = order.returnTime;
  reservation.pickupLocation = order.pickupLocation;
  reservation.returnLocation = order.returnLocation;
  reservation.fullName = order.fullName;
  reservation.phoneNumber = order.phoneNumber;
  reservation.email = order.email;
  reservation.address = order.address;
  reservation.hotelName = order.hotelName;
  reservation.rentalDays = order.rentalDays;
  reservation.deliveryPrice = order.deliveryPrice;
  reservation.returnPrice = order.returnPrice;
  reservation.totalPrice = order.totalPrice;
  reservation.deposit = order.deposit;
  reservation.priceSnapshot = order.priceSnapshot;
  reservation.selectedExtras = order.selectedExtras;
  reservation.hotelDelivery = order.hotelDelivery;

  const updated = await reservationRepository.update(reservation, client);
  return { reservationSynced: true, reservation: updated };
}

/**
 * Soft-delete linked order for a cancelled reservation (removeRange already done by caller).
 */
async function softDeleteOrderForReservation(reservationId, client = null) {
  const order = await orderSql.findOrderByReservationId(reservationId, client);
  if (!order || order.isDeleted) {
    return null;
  }
  order.isDeleted = true;
  order.deletedAt = new Date();
  await orderSql.updateOrderFromDoc(order, client);
  return order;
}

module.exports = {
  syncLinkedOrderAfterReservationMove,
  syncLinkedReservationAfterOrderUpdate,
  softDeleteOrderForReservation,
};
