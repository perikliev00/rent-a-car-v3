/**
 * Admin dashboard aggregates: live order list plus simple revenue/pending stats.
 * Soft-deleted orders are excluded so the panel reflects operable bookings only.
 */
const orderSql = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const { expireFinishedOrders } = require('../sql/bookingSyncSqlService');

/**
 * Load dashboard orders and stats after expiring finished bookings.
 * Expire-first keeps counts aligned with post-rental lifecycle cleanup.
 * @returns {Promise<{orders: object[], stats: {totalOrders: number, totalRevenue: string, pendingOrders: number}}>}
 */
async function getDashboardData() {
  // Close out finished rentals before aggregating so stats exclude stale actives.
  await expireFinishedOrders();

  // Create the orders constant.
  const orders = await orderSql.listOrders({ isDeleted: false });
  // Create the populated orders constant.
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  // Create the total orders constant.
  const totalOrders = populatedOrders.length;
  // Create the total revenue constant.
  const totalRevenue =
    // Continue the surrounding logic with this statement.
    totalOrders > 0
      // Continue the surrounding logic with this statement.
      ? populatedOrders.reduce(
          // Continue the surrounding logic with this statement.
          (sum, order) => sum + parseFloat(order.totalPrice || 0),
          // Supply the literal value used by the enclosing expression.
          0
        )
      // Contribute this line to the enclosing declaration or statement.
      : 0;
  // Create the pending orders constant.
  const pendingOrders =
    // Continue the surrounding logic with this statement.
    totalOrders > 0
      // Continue the surrounding logic with this statement.
      ? populatedOrders.filter(
          // Continue the surrounding logic with this statement.
          (order) => !order.status || order.status === 'pending'
        // Continue the surrounding logic with this statement.
        ).length
      // Contribute this line to the enclosing declaration or statement.
      : 0;

  // Return the resulting value to the caller.
  return {
    // Provide the orders field value.
    orders: populatedOrders || [],
    // Provide the stats field value.
    stats: {
      // Contribute this line to the enclosing declaration or statement.
      totalOrders,
      // Provide the total revenue field value.
      totalRevenue: totalRevenue.toFixed(2),
      // Contribute this line to the enclosing declaration or statement.
      pendingOrders,
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getDashboardData,
};
