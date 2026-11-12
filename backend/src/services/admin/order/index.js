/**
 * Admin order service barrel: list/create/update/delete/restore and form helpers.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  getOrdersList,
  // Contribute this line to the enclosing declaration or statement.
  getExpiredOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  emptyDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  getOrderDetails,
// Continue the surrounding logic with this statement.
} = require('./orderListService');
// Destructure object properties into local variables.
const { getCreateOrderForm, getOrderEditData } = require('./orderFormService');
// Destructure object properties into local variables.
const { getCarAvailability, createOrder } = require('./orderCreateService');
// Destructure object properties into local variables.
const { updateOrder } = require('./orderUpdateService');
// Destructure object properties into local variables.
const { deleteOrder } = require('./orderDeleteService');
// Destructure object properties into local variables.
const { restoreOrder } = require('./orderRestoreService');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getOrdersList,
  // Contribute this line to the enclosing declaration or statement.
  getExpiredOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  emptyDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  getCreateOrderForm,
  // Contribute this line to the enclosing declaration or statement.
  getCarAvailability,
  // Contribute this line to the enclosing declaration or statement.
  createOrder,
  // Contribute this line to the enclosing declaration or statement.
  getOrderDetails,
  // Contribute this line to the enclosing declaration or statement.
  getOrderEditData,
  // Contribute this line to the enclosing declaration or statement.
  updateOrder,
  // Contribute this line to the enclosing declaration or statement.
  deleteOrder,
  // Contribute this line to the enclosing declaration or statement.
  restoreOrder,
};
