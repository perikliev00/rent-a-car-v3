const { DELIVERY_FEES } = require('../../constants/locations');
const { feeFor } = require('../../services/locationService');

module.exports = {
  FEES: DELIVERY_FEES,
  feeFor,
};
