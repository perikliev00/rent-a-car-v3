const {
  mapSqlCar,
  mapPublicCar,
  parsePage,
} = require('./car/carMapper');
const {
  paginateSqlCars,
  getSqlPublicCarById,
  getSqlAdminCarById,
  listAllCars,
  listAllCarImageUrls,
  listAvailableCars,
  listCarsByFilter,
} = require('./car/carSearchQuery');
const {
  createAdminCar,
  updateAdminCar,
  deleteCarById,
} = require('./car/carAdminCrud');
const {
  updateCarStatus,
  findCarStatusForUpdate,
  countActiveFleetReservations,
} = require('./car/carFleetSql');

module.exports = {
  mapSqlCar,
  mapPublicCar,
  paginateSqlCars,
  getSqlPublicCarById,
  getSqlAdminCarById,
  listAllCars,
  listAllCarImageUrls,
  listAvailableCars,
  listCarsByFilter,
  createAdminCar,
  updateAdminCar,
  updateCarStatus,
  findCarStatusForUpdate,
  countActiveFleetReservations,
  deleteCarById,
  parsePage,
};
