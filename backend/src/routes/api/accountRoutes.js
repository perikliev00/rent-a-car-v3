/**
 * Authenticated customer account routes: dashboard, reservations, documents, and PDFs.
 * All routes require a logged-in session via `requireAuthApi`.
 */
const express = require('express');
// Require the '../../controllers/api/accountController' module as accountController.
const accountController = require('../../controllers/api/accountController');
// Destructure object properties into local variables.
const { requireAuthApi } = require('../../middleware/auth');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { customerDocumentUpload } = require('../../middleware/privateUpload');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  accountTravelValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountCancelRequestValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountDocumentUploadValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountPdfKindValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../validators/accountValidationRules');

// Create the router constant.
const router = express.Router();

// Call router.use to perform this step.
router.use(requireAuthApi);

// Aggregated account home (upcoming trips, docs status, etc.).
router.get('/dashboard', accountController.getDashboard);
// List the customer's reservations.
router.get('/reservations', accountController.listReservations);
// Single reservation detail for the logged-in owner.
router.get('/reservations/:id', accountController.getReservation);
// Update flight / travel details on a reservation.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/reservations/:id/travel',
  // Contribute this line to the enclosing declaration or statement.
  accountTravelValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  accountController.updateTravel
);
// Customer-initiated cancellation request (staff may still approve).
router.post(
  // Supply the literal value used by the enclosing expression.
  '/reservations/:id/cancel-request',
  // Contribute this line to the enclosing declaration or statement.
  accountCancelRequestValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  accountController.requestCancellation
);
// Download voucher / invoice PDF kinds for a reservation.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/reservations/:id/pdf/:kind',
  // Contribute this line to the enclosing declaration or statement.
  accountPdfKindValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  accountController.downloadPdf
);

// List private identity / license documents.
router.get('/documents', accountController.listDocuments);
// Upload a private document (multer + magic-byte chain).
router.post(
  // Supply the literal value used by the enclosing expression.
  '/documents',
  // Spread customerDocumentUpload into the surrounding structure.
  ...customerDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  accountDocumentUploadValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  accountController.uploadDocument
);
// Stream a private document download.
router.get('/documents/:id/download', accountController.downloadDocument);
// Soft-delete / remove a customer document.
router.delete('/documents/:id', accountController.deleteDocument);

// Assign the CommonJS module exports.
module.exports = router;
