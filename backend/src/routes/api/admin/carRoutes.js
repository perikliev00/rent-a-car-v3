/**
 * Admin fleet car CRUD plus service, damage, documents, and compliance sub-resources.
 */
const express = require('express');
const carController = require('../../../controllers/api/admin/carController');
const orderController = require('../../../controllers/api/admin/orderController');
const { requirePermission } = require('../../../middleware/auth');
const canManageCars = requirePermission('can_manage_cars');
const canManageFleetAlerts = requirePermission('can_manage_fleet_alerts');
const validateRequest = require('../../../middleware/validateRequest');
const {
  adminCarImageUpload,
  adminCarDocumentUpload,
  adminCarDamagePhotosUpload,
} = require('../../../middleware/adminCarUpload');
const { adminCarIdParamValidation } = require('../../../validators/adminCarIdParamValidation');
const { adminCarAvailabilityQueryValidationRules } = require('../../../validators/adminCarAvailabilityQueryValidationRules');
const {
  createCarValidationRules,
  editCarValidationRules,
  fleetStatusValidationRules,
  serviceRecordValidationRules,
  damageReportValidationRules,
  recordIdParamValidation,
  reportIdParamValidation,
  docIdParamValidation,
  complianceItemIdParamValidation,
  complianceValidationRules,
} = require('../../../validators/carValidationRules');

const router = express.Router();

// Fleet inventory list.
router.get('/', canManageCars, carController.listCars);

// Aggregated fleet alert feed (expiry, maintenance, etc.).
router.get('/fleet-alerts', canManageFleetAlerts, carController.getFleetAlerts);

// Recompute / sync fleet alerts from source tables.
router.post('/fleet-alerts/reconcile', canManageFleetAlerts, carController.reconcileFleetAlerts);

// Availability windows for admin booking UI.
router.get(
  '/:id/availability',
  canManageCars,
  adminCarIdParamValidation,
  adminCarAvailabilityQueryValidationRules,
  validateRequest,
  orderController.getCarAvailability
);

// Change operational fleet status (available / blocked / etc.).
router.post(
  '/:id/status',
  canManageCars,
  adminCarIdParamValidation,
  ...fleetStatusValidationRules,
  validateRequest,
  carController.changeFleetStatus
);

// Service history CRUD.
router.get(
  '/:id/service-records',
  canManageCars,
  adminCarIdParamValidation,
  validateRequest,
  carController.listServiceRecords
);
router.post(
  '/:id/service-records',
  canManageCars,
  adminCarIdParamValidation,
  ...serviceRecordValidationRules,
  validateRequest,
  carController.createServiceRecord
);
router.put(
  '/:id/service-records/:recordId',
  canManageCars,
  adminCarIdParamValidation,
  ...recordIdParamValidation,
  ...serviceRecordValidationRules,
  validateRequest,
  carController.updateServiceRecord
);
router.delete(
  '/:id/service-records/:recordId',
  canManageCars,
  adminCarIdParamValidation,
  ...recordIdParamValidation,
  validateRequest,
  carController.deleteServiceRecord
);

// Damage reports + photo uploads.
router.get(
  '/:id/damage-reports',
  canManageCars,
  adminCarIdParamValidation,
  validateRequest,
  carController.listDamageReports
);
router.post(
  '/:id/damage-reports',
  canManageCars,
  adminCarIdParamValidation,
  ...adminCarDamagePhotosUpload,
  ...damageReportValidationRules,
  validateRequest,
  carController.createDamageReport
);
router.post(
  '/:id/damage-reports/:reportId/resolve',
  canManageCars,
  adminCarIdParamValidation,
  ...reportIdParamValidation,
  validateRequest,
  carController.resolveDamageReport
);
router.delete(
  '/:id/damage-reports/:reportId',
  canManageCars,
  adminCarIdParamValidation,
  ...reportIdParamValidation,
  validateRequest,
  carController.deleteDamageReport
);

// Private car documents (registration, insurance scans, etc.).
router.get(
  '/:id/documents',
  canManageCars,
  adminCarIdParamValidation,
  validateRequest,
  carController.listDocuments
);
router.post(
  '/:id/documents',
  canManageCars,
  adminCarIdParamValidation,
  ...adminCarDocumentUpload,
  carController.uploadDocument
);
router.get(
  '/:id/documents/:docId/download',
  canManageCars,
  adminCarIdParamValidation,
  ...docIdParamValidation,
  validateRequest,
  carController.downloadDocument
);
router.delete(
  '/:id/documents/:docId',
  canManageCars,
  adminCarIdParamValidation,
  ...docIdParamValidation,
  validateRequest,
  carController.deleteDocument
);

// Compliance items (inspection, insurance expiry tracking).
router.get(
  '/:id/compliance',
  canManageCars,
  adminCarIdParamValidation,
  validateRequest,
  carController.listCompliance
);
router.post(
  '/:id/compliance',
  canManageCars,
  adminCarIdParamValidation,
  ...adminCarDocumentUpload,
  ...complianceValidationRules,
  validateRequest,
  carController.createCompliance
);
router.put(
  '/:id/compliance/:itemId',
  canManageCars,
  adminCarIdParamValidation,
  ...complianceItemIdParamValidation,
  ...adminCarDocumentUpload,
  ...complianceValidationRules,
  validateRequest,
  carController.updateCompliance
);
router.get(
  '/:id/compliance/:itemId/download',
  canManageCars,
  adminCarIdParamValidation,
  ...complianceItemIdParamValidation,
  validateRequest,
  carController.downloadComplianceDocument
);
router.delete(
  '/:id/compliance/:itemId',
  canManageCars,
  adminCarIdParamValidation,
  ...complianceItemIdParamValidation,
  validateRequest,
  carController.deleteCompliance
);

// Car detail.
router.get('/:id', canManageCars, adminCarIdParamValidation, carController.getCarById);
// Create car with optional public image upload.
router.post(
  '/',
  canManageCars,
  ...adminCarImageUpload,
  createCarValidationRules,
  carController.createCar
);
// Update car fields / replace image.
router.put(
  '/:id',
  canManageCars,
  adminCarIdParamValidation,
  ...adminCarImageUpload,
  editCarValidationRules,
  carController.updateCar
);
// Soft or hard delete depending on controller policy.
router.delete('/:id', canManageCars, adminCarIdParamValidation, carController.deleteCar);

module.exports = router;
