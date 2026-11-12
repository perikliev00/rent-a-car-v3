/**
 * Authenticated customer account API: dashboard, reservations, travel, documents, and PDFs.
 */
const accountReservationService = require('../../services/account/accountReservationService');
const accountDocumentService = require('../../services/account/accountDocumentService');
const { generatePdf } = require('../../services/pdf/pdfDocumentService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * Extract the authenticated user id from the session.
 * @param {import('express').Request} req
 * @returns {number|string}
 */
function userIdFromReq(req) {
  return req.session.user.id;
}

/**
 * Map known account service errors to API envelope responses.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {import('express').Response} res
 * @param {Error&{status?: number, code?: string}} err
 * @returns {import('express').Response|null}
 */
function respondServiceError(res, err) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

/**
 * Return the authenticated customer account dashboard payload.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getDashboard = asyncHandler(async (req, res, next) => {
  try {
    const data = await accountReservationService.getDashboard(userIdFromReq(req));
    return apiResponse.success(res, data);
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.getDashboard',
      publicMessage: 'Error loading account dashboard.',
    });
  }
});

/**
 * List reservations for the authenticated customer.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listReservations = asyncHandler(async (req, res, next) => {
  try {
    const reservations = await accountReservationService.listReservations(userIdFromReq(req));
    return apiResponse.success(res, { reservations });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.listReservations',
      publicMessage: 'Error loading reservations.',
    });
  }
});

/**
 * Return a single customer reservation by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getReservation = asyncHandler(async (req, res, next) => {
  try {
    const reservation = await accountReservationService.getReservationDetail(
      userIdFromReq(req),
      req.params.id
    );
    return apiResponse.success(res, { reservation });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.getReservation',
      publicMessage: 'Error loading reservation.',
    });
  }
});

/**
 * Update travel details on a customer reservation.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateTravel = asyncHandler(async (req, res, next) => {
  try {
    const reservation = await accountReservationService.updateTravel(
      userIdFromReq(req),
      req.params.id,
      {
        flightNumber: req.body.flightNumber,
        hotelName: req.body.hotelName,
        address: req.body.address,
        specialRequests: req.body.specialRequests,
      }
    );
    return apiResponse.success(res, { reservation });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.updateTravel',
      publicMessage: 'Error updating travel details.',
    });
  }
});

/**
 * Submit a cancellation request for a customer reservation.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.requestCancellation = asyncHandler(async (req, res, next) => {
  try {
    const result = await accountReservationService.requestCancellation(
      req,
      userIdFromReq(req),
      req.params.id,
      req.body.reason
    );
    return apiResponse.success(res, result);
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.requestCancellation',
      publicMessage: 'Error submitting cancellation request.',
    });
  }
});

/**
 * List private documents for the authenticated customer.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listDocuments = asyncHandler(async (req, res, next) => {
  try {
    const documents = await accountDocumentService.listDocuments(userIdFromReq(req));
    return apiResponse.success(res, { documents });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.listDocuments',
      publicMessage: 'Error loading documents.',
    });
  }
});

/**
 * Upload a private customer document.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.uploadDocument = asyncHandler(async (req, res, next) => {
  try {
    const document = await accountDocumentService.uploadDocument(userIdFromReq(req), {
      file: req.file,
      docType: req.body.docType,
      reservationId: req.body.reservationId,
    });
    return apiResponse.success(res, { document }, 201);
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.uploadDocument',
      publicMessage: 'Error uploading document.',
    });
  }
});

/**
 * Download a document by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.downloadDocument = asyncHandler(async (req, res, next) => {
  try {
    const { document, stream } = await accountDocumentService.openDocumentDownload(
      userIdFromReq(req),
      req.params.id
    );
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalFilename || 'document')}"`
    );
    stream.pipe(res);
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.downloadDocument',
      publicMessage: 'Error downloading document.',
    });
  }
});

/**
 * Delete a document by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.deleteDocument = asyncHandler(async (req, res, next) => {
  try {
    const document = await accountDocumentService.deleteDocument(
      userIdFromReq(req),
      req.params.id
    );
    return apiResponse.success(res, { document });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.deleteDocument',
      publicMessage: 'Error deleting document.',
    });
  }
});

/**
 * Download a customer reservation PDF of the requested kind.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.downloadPdf = asyncHandler(async (req, res, next) => {
  try {
    const reservation = await accountReservationService.getReservationForPdf(
      userIdFromReq(req),
      req.params.id
    );
    const { buffer, filename, contentType } = await generatePdf(req.params.kind, reservation);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.downloadPdf',
      publicMessage: 'Error generating PDF.',
    });
  }
});
