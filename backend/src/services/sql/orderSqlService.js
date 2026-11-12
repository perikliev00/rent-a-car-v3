/**
 * Facade for order SQL (query/write/populate/mapper) used by admin and booking sync.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlOrder,
  // Contribute this line to the enclosing declaration or statement.
  attachCarToOrder,
// Continue the surrounding logic with this statement.
} = require('./order/orderMapper');
// Destructure object properties into local variables.
const { populateOrdersWithCars } = require('./order/orderCarPopulate');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  findOrderById,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByIdPopulated,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  listOrders,
// Continue the surrounding logic with this statement.
} = require('./order/orderQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createOrderFromReservation,
  // Contribute this line to the enclosing declaration or statement.
  createAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  updateOrderFromDoc,
  // Contribute this line to the enclosing declaration or statement.
  permanentlyDeleteSoftDeletedOrders,
// Continue the surrounding logic with this statement.
} = require('./order/orderWrite');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlOrder,
  // Contribute this line to the enclosing declaration or statement.
  attachCarToOrder,
  // Contribute this line to the enclosing declaration or statement.
  populateOrdersWithCars,
  // Contribute this line to the enclosing declaration or statement.
  findOrderById,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByIdPopulated,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  listOrders,
  // Contribute this line to the enclosing declaration or statement.
  createOrderFromReservation,
  // Contribute this line to the enclosing declaration or statement.
  createAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  updateOrderFromDoc,
  // Contribute this line to the enclosing declaration or statement.
  permanentlyDeleteSoftDeletedOrders,
};
