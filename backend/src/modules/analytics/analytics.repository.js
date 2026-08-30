const {
  getRevenueTotals,
  getRevenueSeries,
  getRevenueByCar,
  getRevenueByLocation,
} = require('./repository/analyticsRevenueQuery');
const {
  getConfirmedBookingsCount,
  getBookingsSeries,
  getCancelledBookingsCount,
  getFailedPaymentsStats,
  getConversionStats,
} = require('./repository/analyticsBookingsQuery');
const {
  getOccupancyStats,
  getMostRentedCars,
  getUtilizationByCar,
} = require('./repository/analyticsOccupancyQuery');
const {
  getCarPerformance,
  listCarPerformance,
} = require('./repository/analyticsCarPerformanceQuery');

module.exports = {
  getRevenueTotals,
  getRevenueSeries,
  getConfirmedBookingsCount,
  getBookingsSeries,
  getCancelledBookingsCount,
  getFailedPaymentsStats,
  getConversionStats,
  getOccupancyStats,
  getMostRentedCars,
  getRevenueByCar,
  getRevenueByLocation,
  getUtilizationByCar,
  getCarPerformance,
  listCarPerformance,
};
