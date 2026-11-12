/**
 * Admin fleet car CRUD plus service, damage, documents, and compliance sub-resources.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/carController' module as carController.
const carController = require('../../../controllers/api/admin/carController');
// Require the '../../../controllers/api/admin/orderController' module as orderController.
const orderController = require('../../../controllers/api/admin/orderController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Create the can manage cars constant.
const canManageCars = requirePermission('can_manage_cars');
// Create the can manage fleet alerts constant.
const canManageFleetAlerts = requirePermission('can_manage_fleet_alerts');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminCarImageUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminCarDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminCarDamagePhotosUpload,
// Continue the surrounding logic with this statement.
} = require('../../../middleware/adminCarUpload');
// Destructure object properties into local variables.
const { adminCarIdParamValidation } = require('../../../validators/adminCarIdParamValidation');
// Destructure object properties into local variables.
const { adminCarAvailabilityQueryValidationRules } = require('../../../validators/adminCarAvailabilityQueryValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  editCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  fleetStatusValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  serviceRecordValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  damageReportValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  recordIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  reportIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  docIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  complianceItemIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  complianceValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/carValidationRules');

// Create the router constant.
const router = express.Router();

// Fleet inventory list.
router.get('/', canManageCars, carController.listCars);

// Aggregated fleet alert feed (expiry, maintenance, etc.).
router.get('/fleet-alerts', canManageFleetAlerts, carController.getFleetAlerts);

// Recompute / sync fleet alerts from source tables.
router.post('/fleet-alerts/reconcile', canManageFleetAlerts, carController.reconcileFleetAlerts);

// Availability windows for admin booking UI.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/availability',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  adminCarAvailabilityQueryValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  orderController.getCarAvailability
);

// Change operational fleet status (available / blocked / etc.).
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/status',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread fleetStatusValidationRules into the surrounding structure.
  ...fleetStatusValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.changeFleetStatus
);

// Service history CRUD.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/service-records',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.listServiceRecords
);
// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/service-records',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread serviceRecordValidationRules into the surrounding structure.
  ...serviceRecordValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.createServiceRecord
);
// Call router.put to perform this step.
router.put(
  // Supply the literal value used by the enclosing expression.
  '/:id/service-records/:recordId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread recordIdParamValidation into the surrounding structure.
  ...recordIdParamValidation,
  // Spread serviceRecordValidationRules into the surrounding structure.
  ...serviceRecordValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.updateServiceRecord
);
// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id/service-records/:recordId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread recordIdParamValidation into the surrounding structure.
  ...recordIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.deleteServiceRecord
);

// Damage reports + photo uploads.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/damage-reports',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.listDamageReports
);
// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/damage-reports',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread adminCarDamagePhotosUpload into the surrounding structure.
  ...adminCarDamagePhotosUpload,
  // Spread damageReportValidationRules into the surrounding structure.
  ...damageReportValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.createDamageReport
);
// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/damage-reports/:reportId/resolve',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread reportIdParamValidation into the surrounding structure.
  ...reportIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.resolveDamageReport
);
// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id/damage-reports/:reportId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread reportIdParamValidation into the surrounding structure.
  ...reportIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.deleteDamageReport
);

// Private car documents (registration, insurance scans, etc.).
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/documents',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.listDocuments
);
// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/documents',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread adminCarDocumentUpload into the surrounding structure.
  ...adminCarDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  carController.uploadDocument
);
// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/documents/:docId/download',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread docIdParamValidation into the surrounding structure.
  ...docIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.downloadDocument
);
// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id/documents/:docId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread docIdParamValidation into the surrounding structure.
  ...docIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.deleteDocument
);

// Compliance items (inspection, insurance expiry tracking).
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/compliance',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.listCompliance
);
// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/compliance',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread adminCarDocumentUpload into the surrounding structure.
  ...adminCarDocumentUpload,
  // Spread complianceValidationRules into the surrounding structure.
  ...complianceValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.createCompliance
);
// Call router.put to perform this step.
router.put(
  // Supply the literal value used by the enclosing expression.
  '/:id/compliance/:itemId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread complianceItemIdParamValidation into the surrounding structure.
  ...complianceItemIdParamValidation,
  // Spread adminCarDocumentUpload into the surrounding structure.
  ...adminCarDocumentUpload,
  // Spread complianceValidationRules into the surrounding structure.
  ...complianceValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.updateCompliance
);
// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/compliance/:itemId/download',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread complianceItemIdParamValidation into the surrounding structure.
  ...complianceItemIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.downloadComplianceDocument
);
// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id/compliance/:itemId',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread complianceItemIdParamValidation into the surrounding structure.
  ...complianceItemIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.deleteCompliance
);

// Car detail.
router.get('/:id', canManageCars, adminCarIdParamValidation, carController.getCarById);
// Create car with optional public image upload.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Spread adminCarImageUpload into the surrounding structure.
  ...adminCarImageUpload,
  // Contribute this line to the enclosing declaration or statement.
  createCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  carController.createCar
);
// Update car fields / replace image.
router.put(
  // Supply the literal value used by the enclosing expression.
  '/:id',
  // Contribute this line to the enclosing declaration or statement.
  canManageCars,
  // Contribute this line to the enclosing declaration or statement.
  adminCarIdParamValidation,
  // Spread adminCarImageUpload into the surrounding structure.
  ...adminCarImageUpload,
  // Contribute this line to the enclosing declaration or statement.
  editCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  carController.updateCar
);
// Soft or hard delete depending on controller policy.
router.delete('/:id', canManageCars, adminCarIdParamValidation, carController.deleteCar);

// Assign the CommonJS module exports.
module.exports = router;
