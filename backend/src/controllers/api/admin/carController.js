/**
 * Facade re-exporting admin car sub-controllers (CRUD, alerts, service, damage, documents, compliance).
 * Keeps route imports stable while implementations live under `car/`.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  listCars,
  // Contribute this line to the enclosing declaration or statement.
  getCarById,
  // Contribute this line to the enclosing declaration or statement.
  createCar,
  // Contribute this line to the enclosing declaration or statement.
  updateCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCar,
  // Contribute this line to the enclosing declaration or statement.
  changeFleetStatus,
// Continue the surrounding logic with this statement.
} = require('./car/carCrudController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
// Continue the surrounding logic with this statement.
} = require('./car/carAlertsController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listServiceRecords,
  // Contribute this line to the enclosing declaration or statement.
  createServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  updateServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  deleteServiceRecord,
// Continue the surrounding logic with this statement.
} = require('./car/carServiceController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listDamageReports,
  // Contribute this line to the enclosing declaration or statement.
  createDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  resolveDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  deleteDamageReport,
// Continue the surrounding logic with this statement.
} = require('./car/carDamageController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  downloadDocument,
  // Contribute this line to the enclosing declaration or statement.
  deleteDocument,
// Continue the surrounding logic with this statement.
} = require('./car/carDocumentsController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listCompliance,
  // Contribute this line to the enclosing declaration or statement.
  createCompliance,
  // Contribute this line to the enclosing declaration or statement.
  updateCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCompliance,
  // Contribute this line to the enclosing declaration or statement.
  downloadComplianceDocument,
// Continue the surrounding logic with this statement.
} = require('./car/carComplianceController');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCars,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  getCarById,
  // Contribute this line to the enclosing declaration or statement.
  createCar,
  // Contribute this line to the enclosing declaration or statement.
  updateCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCar,
  // Contribute this line to the enclosing declaration or statement.
  changeFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  listServiceRecords,
  // Contribute this line to the enclosing declaration or statement.
  createServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  updateServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  deleteServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  listDamageReports,
  // Contribute this line to the enclosing declaration or statement.
  createDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  resolveDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  deleteDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  downloadDocument,
  // Contribute this line to the enclosing declaration or statement.
  deleteDocument,
  // Contribute this line to the enclosing declaration or statement.
  listCompliance,
  // Contribute this line to the enclosing declaration or statement.
  createCompliance,
  // Contribute this line to the enclosing declaration or statement.
  updateCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCompliance,
  // Contribute this line to the enclosing declaration or statement.
  downloadComplianceDocument,
};
