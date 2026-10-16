/**
 * Admin dashboard aggregates: live order list plus simple revenue/pending stats.
 * Soft-deleted orders are excluded so the panel reflects operable bookings only.
 */
const orderSql = require('../sql/orderSqlService');
const { expireFinishedOrders } = require('../sql/bookingSyncSqlService');

/**
 * Load dashboard orders and stats after expiring finished bookings.
 * Expire-first keeps counts aligned with post-rental lifecycle cleanup.
 * @returns {Promise<{orders: object[], stats: {totalOrders: number, totalRevenue: string, pendingOrders: number}}>}
 */
async function getDashboardData() {
  // Close out finished rentals before aggregating so stats exclude stale actives.
  await expireFinishedOrders();

  const orders = await orderSql.listOrders({ isDeleted: false });
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  const totalOrders = populatedOrders.length;
  const totalRevenue =
    totalOrders > 0
      ? populatedOrders.reduce(
          (sum, order) => sum + parseFloat(order.totalPrice || 0),
          0
        )
      : 0;
  const pendingOrders =
    totalOrders > 0
      ? populatedOrders.filter(
          (order) => !order.status || order.status === 'pending'
        ).length
      : 0;

  return {
    orders: populatedOrders || [],
    stats: {
      totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      pendingOrders,
    },
  };
}

module.exports = {
  getDashboardData,
};
