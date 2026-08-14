const express = require('express');
const accountController = require('../../controllers/api/accountController');
const { requireAuthApi } = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const { customerDocumentUpload } = require('../../middleware/privateUpload');
const {
  accountTravelValidationRules,
  accountCancelRequestValidationRules,
  accountDocumentUploadValidationRules,
  accountPdfKindValidationRules,
} = require('../../validators/accountValidationRules');

const router = express.Router();

router.use(requireAuthApi);

router.get('/dashboard', accountController.getDashboard);
router.get('/reservations', accountController.listReservations);
router.get('/reservations/:id', accountController.getReservation);
router.patch(
  '/reservations/:id/travel',
  accountTravelValidationRules,
  validateRequest,
  accountController.updateTravel
);
router.post(
  '/reservations/:id/cancel-request',
  accountCancelRequestValidationRules,
  validateRequest,
  accountController.requestCancellation
);
router.get(
  '/reservations/:id/pdf/:kind',
  accountPdfKindValidationRules,
  validateRequest,
  accountController.downloadPdf
);

router.get('/documents', accountController.listDocuments);
router.post(
  '/documents',
  ...customerDocumentUpload,
  accountDocumentUploadValidationRules,
  validateRequest,
  accountController.uploadDocument
);
router.get('/documents/:id/download', accountController.downloadDocument);
router.delete('/documents/:id', accountController.deleteDocument);

module.exports = router;
