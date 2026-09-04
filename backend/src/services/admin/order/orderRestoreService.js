const orderSql = require('../../sql/orderSqlService');
const carRepository = require('../../../repositories/carRepository');
const reservationRepository = require('../../../repositories/reservationRepository');
const { purgeExpired, addRange } = require('../../sql/bookingSyncSqlService');
const { parseOrderDateRange } = require('./orderDomainService');
const {
  RESERVATION_CONFLICT_MESSAGE,
  assertNoActiveReservationHold,
  assertNoOpenPhysicalRental,
} = require('./orderConflictService');
const { toISODate } = require('./orderMapper');
const { OrderRestoreError, runWithOptionalTransaction } = require('./orderShared');
const { ensureLinkedConfirmedReservation } = require('./orderReservationLinkService');
const { syncLinkedReservationAfterOrderUpdate } = require('./orderReservationSync');
const { acquireCarAdvisoryLocks } = require('../../../db/transaction');

async function restoreOrder(orderId) {
  try {
    await runWithOptionalTransaction(async (client) => {
      const order = await orderSql.findOrderById(orderId, client);
      if (!order || !order.isDeleted) {
        throw new OrderRestoreError(
          'RESTORE_INVALID',
          'Cannot restore: order not found or not in bin.'
        );
      }

      let range;
      try {
        range = parseOrderDateRange(
          toISODate(order.pickupDate),
          order.pickupTime,
          toISODate(order.returnDate),
          order.returnTime
        );
      } catch {
        throw new OrderRestoreError(
          'INVALID_RANGE',
          'Cannot restore: order has invalid stored dates.'
        );
      }

      const car = await carRepository.findByIdForAdmin(order.carId);
      if (!car || car.isDeleted) {
        throw new OrderRestoreError(
          'CAR_UNAVAILABLE',
          'Cannot restore: car no longer exists in the fleet.'
        );
      }

      await acquireCarAdvisoryLocks(client, [order.carId]);
      await assertNoActiveReservationHold(order.carId, range.start, range.end, client);
      await assertNoOpenPhysicalRental(order.carId, client, {
        excludeReservationId: order.reservationId,
      });

      await purgeExpired(order.carId, client);
      await addRange(order.carId, range.start, range.end, client);

      order.isDeleted = false;
      order.deletedAt = undefined;

      const now = new Date();
      if (range.end <= now) {
        order.status = 'expired';
        if (!order.expiredAt) {
          order.expiredAt = now;
        }
      } else if (
        !order.status ||
        order.status === 'expired' ||
        order.status === 'cancelled'
      ) {
        order.status = 'active';
        order.expiredAt = undefined;
      }

      if (order.reservationId) {
        const existing = await reservationRepository.findById(order.reservationId, client);
        if (!existing || existing.status === 'cancelled') {
          order.reservationId = undefined;
        }
      }

      if (!order.reservationId) {
        const reservation = await ensureLinkedConfirmedReservation(order, {
          actor: { type: 'admin' },
          client,
        });
        order.reservationId = reservation.id;
      } else {
        await syncLinkedReservationAfterOrderUpdate(order, { client });
      }

      await orderSql.updateOrderFromDoc(order, client);
    });
  } catch (err) {
    if (err.isOrderRestoreError) {
      throw err;
    }
    if (err && err.code === 'OVERLAP') {
      throw new OrderRestoreError(
        'OVERLAP',
        'Cannot restore order: car is already booked in that period.'
      );
    }
    if (err && err.code === 'RESERVATION_CONFLICT') {
      throw new OrderRestoreError('RESERVATION_HOLD', RESERVATION_CONFLICT_MESSAGE);
    }
    if (err && err.code === 'OPEN_PHYSICAL_RENTAL') {
      throw new OrderRestoreError(
        'OPEN_PHYSICAL_RENTAL',
        err.message ||
          'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
      );
    }
    throw err;
  }
}

module.exports = {
  restoreOrder,
};
