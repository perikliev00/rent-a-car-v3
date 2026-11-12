/**
 * Delivery fee constants and location fee lookup (re-exported from locations / locationService).
 */

const { DELIVERY_FEES } = require('../../constants/locations');
const { feeFor } = require('../../services/locationService');

module.exports = {
  FEES: DELIVERY_FEES,
  feeFor,
};
