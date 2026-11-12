/**
 * Soft-delete an admin order. When a reservation is linked, cancel that
 * reservation (which owns calendar cleanup); otherwise remove the date range
 * and soft-delete the order directly.
 */
const orderSql = require('../../sql/orderSqlService');
// Destructure object properties into local variables.
const { removeRange } = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { resolveOrderDate } = require('./orderMapper');
// Destructure object properties into local variables.
const { resolveStoredDateRange } = require('./orderConflictService');
// Destructure object properties into local variables.
const { runWithOptionalTransaction } = require('./orderShared');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');

/**
 * Soft-delete order by id (no-op if already deleted / missing).
 * @param {number|string} orderId
 */
async function deleteOrder(orderId) {
  // Wait until the asynchronous operation resolves.
  await runWithOptionalTransaction(async (client) => {
    // Create the order constant.
    const order = await orderSql.findOrderById(orderId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!order || order.isDeleted) return;

    // Linked reservation path: cancel reservation; its hooks soft-delete the order.
    if (order.reservationId) {
      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Provide the reservation id field value.
        reservationId: order.reservationId,
        // Provide the new status field value.
        newStatus: 'cancelled',
        // Provide the reason field value.
        reason: 'admin_order_delete',
        // Provide the actor field value.
        actor: { type: 'admin' },
        // Contribute this line to the enclosing declaration or statement.
        client,
      });
      // Return control to the caller with the following value.
      return;
    }

    // Create the prev start constant.
    const prevStart = resolveOrderDate(order.pickupDate, order.pickupTime, '00:00');
    // Create the prev end constant.
    const prevEnd = resolveOrderDate(order.returnDate, order.returnTime, '23:59');

    // Destructure object properties into local variables.
    const { storedStart, storedEnd } = await resolveStoredDateRange(
      // Contribute this line to the enclosing declaration or statement.
      order.carId,
      // Contribute this line to the enclosing declaration or statement.
      prevStart,
      // Contribute this line to the enclosing declaration or statement.
      prevEnd,
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Wait until the asynchronous operation resolves.
    await removeRange(order.carId, storedStart, storedEnd, client);
    // Update order.isDeleted with the right-hand side value.
    order.isDeleted = true;
    // Update order.deletedAt with the right-hand side value.
    order.deletedAt = new Date();
    // Wait until the asynchronous operation resolves.
    await orderSql.updateOrderFromDoc(order, client);
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  deleteOrder,
};
