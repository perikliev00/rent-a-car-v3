const {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
} = require('./car/carCrudController');
const {
  getFleetAlerts,
  reconcileFleetAlerts,
} = require('./car/carAlertsController');
const {
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
} = require('./car/carServiceController');
const {
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
} = require('./car/carDamageController');
const {
  listDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
} = require('./car/carDocumentsController');
const {
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  downloadComplianceDocument,
} = require('./car/carComplianceController');

module.exports = {
  listCars,
  getFleetAlerts,
  reconcileFleetAlerts,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
  listDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  downloadComplianceDocument,
};
