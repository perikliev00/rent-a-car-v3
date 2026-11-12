/**
 * Analytics repository facade over revenue, bookings, occupancy, and car-performance SQL.
 */

const {
  // Contribute this line to the enclosing declaration or statement.
  getRevenueTotals,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueSeries,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByCar,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByLocation,
// Continue the surrounding logic with this statement.
} = require('./repository/analyticsRevenueQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getConfirmedBookingsCount,
  // Contribute this line to the enclosing declaration or statement.
  getBookingsSeries,
  // Contribute this line to the enclosing declaration or statement.
  getCancelledBookingsCount,
  // Contribute this line to the enclosing declaration or statement.
  getFailedPaymentsStats,
  // Contribute this line to the enclosing declaration or statement.
  getConversionStats,
// Continue the surrounding logic with this statement.
} = require('./repository/analyticsBookingsQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getOccupancyStats,
  // Contribute this line to the enclosing declaration or statement.
  getMostRentedCars,
  // Contribute this line to the enclosing declaration or statement.
  getUtilizationByCar,
// Continue the surrounding logic with this statement.
} = require('./repository/analyticsOccupancyQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getCarPerformance,
  // Contribute this line to the enclosing declaration or statement.
  listCarPerformance,
// Continue the surrounding logic with this statement.
} = require('./repository/analyticsCarPerformanceQuery');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getRevenueTotals,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueSeries,
  // Contribute this line to the enclosing declaration or statement.
  getConfirmedBookingsCount,
  // Contribute this line to the enclosing declaration or statement.
  getBookingsSeries,
  // Contribute this line to the enclosing declaration or statement.
  getCancelledBookingsCount,
  // Contribute this line to the enclosing declaration or statement.
  getFailedPaymentsStats,
  // Contribute this line to the enclosing declaration or statement.
  getConversionStats,
  // Contribute this line to the enclosing declaration or statement.
  getOccupancyStats,
  // Contribute this line to the enclosing declaration or statement.
  getMostRentedCars,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByCar,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByLocation,
  // Contribute this line to the enclosing declaration or statement.
  getUtilizationByCar,
  // Contribute this line to the enclosing declaration or statement.
  getCarPerformance,
  // Contribute this line to the enclosing declaration or statement.
  listCarPerformance,
};
