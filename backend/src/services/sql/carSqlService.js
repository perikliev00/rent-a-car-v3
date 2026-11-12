/**
 * Facade re-exporting car search, fleet, admin CRUD, and mapper SQL helpers.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  mapSqlCar,
  // Contribute this line to the enclosing declaration or statement.
  mapPublicCar,
  // Contribute this line to the enclosing declaration or statement.
  parsePage,
// Continue the surrounding logic with this statement.
} = require('./car/carMapper');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  paginateSqlCars,
  // Contribute this line to the enclosing declaration or statement.
  getSqlPublicCarById,
  // Contribute this line to the enclosing declaration or statement.
  getSqlAdminCarById,
  // Contribute this line to the enclosing declaration or statement.
  listAllCars,
  // Contribute this line to the enclosing declaration or statement.
  listAllCarImageUrls,
  // Contribute this line to the enclosing declaration or statement.
  listAvailableCars,
  // Contribute this line to the enclosing declaration or statement.
  listCarsByFilter,
// Continue the surrounding logic with this statement.
} = require('./car/carSearchQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarById,
// Continue the surrounding logic with this statement.
} = require('./car/carAdminCrud');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  updateCarStatus,
  // Contribute this line to the enclosing declaration or statement.
  findCarStatusForUpdate,
  // Contribute this line to the enclosing declaration or statement.
  countActiveFleetReservations,
// Continue the surrounding logic with this statement.
} = require('./car/carFleetSql');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapSqlCar,
  // Contribute this line to the enclosing declaration or statement.
  mapPublicCar,
  // Contribute this line to the enclosing declaration or statement.
  paginateSqlCars,
  // Contribute this line to the enclosing declaration or statement.
  getSqlPublicCarById,
  // Contribute this line to the enclosing declaration or statement.
  getSqlAdminCarById,
  // Contribute this line to the enclosing declaration or statement.
  listAllCars,
  // Contribute this line to the enclosing declaration or statement.
  listAllCarImageUrls,
  // Contribute this line to the enclosing declaration or statement.
  listAvailableCars,
  // Contribute this line to the enclosing declaration or statement.
  listCarsByFilter,
  // Contribute this line to the enclosing declaration or statement.
  createAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateCarStatus,
  // Contribute this line to the enclosing declaration or statement.
  findCarStatusForUpdate,
  // Contribute this line to the enclosing declaration or statement.
  countActiveFleetReservations,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarById,
  // Contribute this line to the enclosing declaration or statement.
  parsePage,
};
