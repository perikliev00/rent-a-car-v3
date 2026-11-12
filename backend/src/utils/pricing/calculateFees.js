/**
 * Delivery fee constants and location fee lookup (re-exported from locations / locationService).
 */

const { DELIVERY_FEES } = require('../../constants/locations');
// Destructure object properties into local variables.
const { feeFor } = require('../../services/locationService');

// Assign the CommonJS module exports.
module.exports = {
  // Provide the fees field value.
  FEES: DELIVERY_FEES,
  // Contribute this line to the enclosing declaration or statement.
  feeFor,
};
