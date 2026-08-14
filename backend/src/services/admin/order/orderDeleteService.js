const orderSql = require('../../sql/orderSqlService');
const { removeRange } = require('../../sql/bookingSyncSqlService');
const { resolveOrderDate } = require('./orderMapper');
const { resolveStoredDateRange } = require('./orderConflictService');
const { runWithOptionalTransaction } = require('./orderShared');
const { changeStatus } = require('../../reservation/reservationStatusService');

async function deleteOrder(orderId) {
  await runWithOptionalTransaction(async (client) => {
    const order = await orderSql.findOrderById(orderId, client);
    if (!order || order.isDeleted) return;

    if (order.reservationId) {
      await changeStatus({
        reservationId: order.reservationId,
        newStatus: 'cancelled',
        reason: 'admin_order_delete',
        actor: { type: 'admin' },
        client,
      });
      return;
    }

    const prevStart = resolveOrderDate(order.pickupDate, order.pickupTime, '00:00');
    const prevEnd = resolveOrderDate(order.returnDate, order.returnTime, '23:59');

    const { storedStart, storedEnd } = await resolveStoredDateRange(
      order.carId,
      prevStart,
      prevEnd,
      client
    );

    await removeRange(order.carId, storedStart, storedEnd, client);
    order.isDeleted = true;
    order.deletedAt = new Date();
    await orderSql.updateOrderFromDoc(order, client);
  });
}

module.exports = {
  deleteOrder,
};
