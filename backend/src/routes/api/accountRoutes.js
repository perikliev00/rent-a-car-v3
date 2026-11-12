/**
 * Authenticated customer account routes: dashboard, reservations, documents, and PDFs.
 * All routes require a logged-in session via `requireAuthApi`.
 */
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

// Aggregated account home (upcoming trips, docs status, etc.).
router.get('/dashboard', accountController.getDashboard);
// List the customer's reservations.
router.get('/reservations', accountController.listReservations);
// Single reservation detail for the logged-in owner.
router.get('/reservations/:id', accountController.getReservation);
// Update flight / travel details on a reservation.
router.patch(
  '/reservations/:id/travel',
  accountTravelValidationRules,
  validateRequest,
  accountController.updateTravel
);
// Customer-initiated cancellation request (staff may still approve).
router.post(
  '/reservations/:id/cancel-request',
  accountCancelRequestValidationRules,
  validateRequest,
  accountController.requestCancellation
);
// Download voucher / invoice PDF kinds for a reservation.
router.get(
  '/reservations/:id/pdf/:kind',
  accountPdfKindValidationRules,
  validateRequest,
  accountController.downloadPdf
);

// List private identity / license documents.
router.get('/documents', accountController.listDocuments);
// Upload a private document (multer + magic-byte chain).
router.post(
  '/documents',
  ...customerDocumentUpload,
  accountDocumentUploadValidationRules,
  validateRequest,
  accountController.uploadDocument
);
// Stream a private document download.
router.get('/documents/:id/download', accountController.downloadDocument);
// Soft-delete / remove a customer document.
router.delete('/documents/:id', accountController.deleteDocument);

module.exports = router;
