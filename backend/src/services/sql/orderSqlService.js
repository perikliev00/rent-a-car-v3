const {
  ALLOWED_STATUSES,
  mapSqlOrder,
  attachCarToOrder,
} = require('./order/orderMapper');
const { populateOrdersWithCars } = require('./order/orderCarPopulate');
const {
  findOrderById,
  findOrderByIdPopulated,
  findOrderByReservationId,
  findOrderByStripeSessionId,
  listOrders,
} = require('./order/orderQuery');
const {
  createOrderFromReservation,
  createAdminOrder,
  updateOrderFromDoc,
  permanentlyDeleteSoftDeletedOrders,
} = require('./order/orderWrite');

module.exports = {
  ALLOWED_STATUSES,
  mapSqlOrder,
  attachCarToOrder,
  populateOrdersWithCars,
  findOrderById,
  findOrderByIdPopulated,
  findOrderByReservationId,
  findOrderByStripeSessionId,
  listOrders,
  createOrderFromReservation,
  createAdminOrder,
  updateOrderFromDoc,
  permanentlyDeleteSoftDeletedOrders,
};
