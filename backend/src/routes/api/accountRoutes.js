const express = require('express');
const accountController = require('../../controllers/api/accountController');
const { requireAuthApi, requireVerifiedEmailApi } = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const { customerDocumentUpload } = require('../../middleware/privateUpload');
const { claimLimiter } = require('../../middleware/rateLimit');
const {
  accountTravelValidationRules,
  accountCancelRequestValidationRules,
  accountDocumentUploadValidationRules,
  accountPdfKindValidationRules,
  accountClaimValidationRules,
  accountClaimRequestValidationRules,
} = require('../../validators/accountValidationRules');

const router = express.Router();

router.use(requireAuthApi);
// Historical account ownership is fail-closed: an authenticated but unverified session
// gets nothing from this router, including reservations, documents and PDFs.
router.use(requireVerifiedEmailApi);

router.get('/dashboard', accountController.getDashboard);
router.get('/reservations', accountController.listReservations);
router.post(
  '/reservations/claim-request',
  claimLimiter,
  accountClaimRequestValidationRules,
  validateRequest,
  accountController.requestClaimToken
);
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
router.post(
  '/reservations/:id/claim',
  claimLimiter,
  accountClaimValidationRules,
  validateRequest,
  accountController.claimReservation
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
