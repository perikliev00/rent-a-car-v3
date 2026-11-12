/**
 * Restore a soft-deleted order from the recycle bin: re-check conflicts,
 * re-add the calendar range, clear soft-delete flags, and re-link reservation.
 */
const orderSql = require('../../sql/orderSqlService');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Require the '../../../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { purgeExpired, addRange } = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { parseOrderDateRange } = require('./orderDomainService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_CONFLICT_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('./orderConflictService');
// Destructure object properties into local variables.
const { toISODate } = require('./orderMapper');
// Destructure object properties into local variables.
const { OrderRestoreError, runWithOptionalTransaction } = require('./orderShared');
// Destructure object properties into local variables.
const { ensureLinkedConfirmedReservation } = require('./orderReservationLinkService');
// Destructure object properties into local variables.
const { syncLinkedReservationAfterOrderUpdate } = require('./orderReservationSync');
// Destructure object properties into local variables.
const { acquireCarAdvisoryLocks } = require('../../../db/transaction');

/**
 * Restore order by id; maps conflict codes to OrderRestoreError for the UI.
 * @param {number|string} orderId
 */
async function restoreOrder(orderId) {
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await runWithOptionalTransaction(async (client) => {
      // Create the order constant.
      const order = await orderSql.findOrderById(orderId, client);
      // Evaluate the condition and enter the branch when it is true.
      if (!order || !order.isDeleted) {
        // Throw an error to stop the current control flow.
        throw new OrderRestoreError(
          // Supply the literal value used by the enclosing expression.
          'RESTORE_INVALID',
          // Supply the literal value used by the enclosing expression.
          'Cannot restore: order not found or not in bin.'
        );
      }

      // Reserve the range variable for later assignment.
      let range;
      // Start a try block for operations that may fail.
      try {
        // Update range with the right-hand side value.
        range = parseOrderDateRange(
          // Call toISODate to perform this step.
          toISODate(order.pickupDate),
          // Contribute this line to the enclosing declaration or statement.
          order.pickupTime,
          // Call toISODate to perform this step.
          toISODate(order.returnDate),
          // Contribute this line to the enclosing declaration or statement.
          order.returnTime
        );
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Throw an error to stop the current control flow.
        throw new OrderRestoreError(
          // Supply the literal value used by the enclosing expression.
          'INVALID_RANGE',
          // Supply the literal value used by the enclosing expression.
          'Cannot restore: order has invalid stored dates.'
        );
      }

      // Create the car constant.
      const car = await carRepository.findByIdForAdmin(order.carId);
      // Evaluate the condition and enter the branch when it is true.
      if (!car || car.isDeleted) {
        // Throw an error to stop the current control flow.
        throw new OrderRestoreError(
          // Supply the literal value used by the enclosing expression.
          'CAR_UNAVAILABLE',
          // Supply the literal value used by the enclosing expression.
          'Cannot restore: car no longer exists in the fleet.'
        );
      }

      // Wait until the asynchronous operation resolves.
      await acquireCarAdvisoryLocks(client, [order.carId]);
      // Wait until the asynchronous operation resolves.
      await assertNoActiveReservationHold(order.carId, range.start, range.end, client);
      // Wait until the asynchronous operation resolves.
      await assertNoOpenPhysicalRental(order.carId, client, {
        // Provide the exclude reservation id field value.
        excludeReservationId: order.reservationId,
      });

      // Wait until the asynchronous operation resolves.
      await purgeExpired(order.carId, client);
      // Wait until the asynchronous operation resolves.
      await addRange(order.carId, range.start, range.end, client);

      // Update order.isDeleted with the right-hand side value.
      order.isDeleted = false;
      // Update order.deletedAt with the right-hand side value.
      order.deletedAt = undefined;

      // Past returns stay expired; cancelled/blank statuses become active again.
      const now = new Date();
      // Evaluate the condition and enter the branch when it is true.
      if (range.end <= now) {
        // Update order.status with the right-hand side value.
        order.status = 'expired';
        // Evaluate the condition and enter the branch when it is true.
        if (!order.expiredAt) {
          // Update order.expiredAt with the right-hand side value.
          order.expiredAt = now;
        }
      // Continue the surrounding logic with this statement.
      } else if (
        // Contribute this line to the enclosing declaration or statement.
        !order.status ||
        // Update order.status with the right-hand side value.
        order.status === 'expired' ||
        // Update order.status with the right-hand side value.
        order.status === 'cancelled'
      // Continue the surrounding logic with this statement.
      ) {
        // Update order.status with the right-hand side value.
        order.status = 'active';
        // Update order.expiredAt with the right-hand side value.
        order.expiredAt = undefined;
      }

      // Drop cancelled/missing reservation links so we can create a fresh confirmed one.
      if (order.reservationId) {
        // Create the existing constant.
        const existing = await reservationRepository.findById(order.reservationId, client);
        // Evaluate the condition and enter the branch when it is true.
        if (!existing || existing.status === 'cancelled') {
          // Update order.reservationId with the right-hand side value.
          order.reservationId = undefined;
        }
      }

      // Evaluate the condition and enter the branch when it is true.
      if (!order.reservationId) {
        // Create the reservation constant.
        const reservation = await ensureLinkedConfirmedReservation(order, {
          // Provide the actor field value.
          actor: { type: 'admin' },
          // Contribute this line to the enclosing declaration or statement.
          client,
        });
        // Update order.reservationId with the right-hand side value.
        order.reservationId = reservation.id;
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Wait until the asynchronous operation resolves.
        await syncLinkedReservationAfterOrderUpdate(order, { client });
      }

      // Wait until the asynchronous operation resolves.
      await orderSql.updateOrderFromDoc(order, client);
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.isOrderRestoreError) {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Concurrency / overlap guard (race-sensitive).
    if (err && err.code === 'OVERLAP') {
      // Throw an error to stop the current control flow.
      throw new OrderRestoreError(
        // Supply the literal value used by the enclosing expression.
        'OVERLAP',
        // Supply the literal value used by the enclosing expression.
        'Cannot restore order: car is already booked in that period.'
      );
    }
    // Concurrency / overlap guard (race-sensitive).
    if (err && err.code === 'RESERVATION_CONFLICT') {
      // Throw an error to stop the current control flow.
      throw new OrderRestoreError('RESERVATION_HOLD', RESERVATION_CONFLICT_MESSAGE);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err && err.code === 'OPEN_PHYSICAL_RENTAL') {
      // Throw an error to stop the current control flow.
      throw new OrderRestoreError(
        // Supply the literal value used by the enclosing expression.
        'OPEN_PHYSICAL_RENTAL',
        // Contribute this line to the enclosing declaration or statement.
        err.message ||
          // Continue the surrounding logic with this statement.
          'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
      );
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  restoreOrder,
};
