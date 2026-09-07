const {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
} = require('./car/carAdminCrudService');
const {
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
} = require('./car/carAdminServiceRecords');
const {
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
} = require('./car/carAdminDamageService');
const {
  listDocuments,
  uploadDocument,
  deleteDocument,
  openDocumentDownload,
} = require('./car/carAdminDocumentsService');
const {
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  openComplianceDocumentDownload,
  getFleetAlerts,
  reconcileFleetAlerts,
} = require('./car/carAdminComplianceService');
const { buildCarFormState } = require('./car/carAdminPayload');

module.exports = {
  listCars,
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
  deleteDocument,
  openDocumentDownload,
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  openComplianceDocumentDownload,
  getFleetAlerts,
  reconcileFleetAlerts,
  buildCarFormState,
};
