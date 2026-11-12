/**
 * Public facade for admin car fleet operations. Re-exports CRUD, service
 * records, damage reports, documents, compliance, and fleet alerts.
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
} = require('./car/carAdminCrudService');
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
} = require('./car/carAdminServiceRecords');
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
} = require('./car/carAdminDamageService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  deleteDocument,
  // Contribute this line to the enclosing declaration or statement.
  openDocumentDownload,
// Continue the surrounding logic with this statement.
} = require('./car/carAdminDocumentsService');
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
  openComplianceDocumentDownload,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
// Continue the surrounding logic with this statement.
} = require('./car/carAdminComplianceService');
// Destructure object properties into local variables.
const { buildCarFormState } = require('./car/carAdminPayload');

// Assign the CommonJS module exports.
module.exports = {
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
  deleteDocument,
  // Contribute this line to the enclosing declaration or statement.
  openDocumentDownload,
  // Contribute this line to the enclosing declaration or statement.
  listCompliance,
  // Contribute this line to the enclosing declaration or statement.
  createCompliance,
  // Contribute this line to the enclosing declaration or statement.
  updateCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCompliance,
  // Contribute this line to the enclosing declaration or statement.
  openComplianceDocumentDownload,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  buildCarFormState,
};
