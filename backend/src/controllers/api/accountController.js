/**
 * Authenticated customer account API: dashboard, reservations, travel, documents, and PDFs.
 */
const accountReservationService = require('../../services/account/accountReservationService');
// Require the '../../services/account/accountDocumentService' module as accountDocumentService.
const accountDocumentService = require('../../services/account/accountDocumentService');
// Destructure object properties into local variables.
const { generatePdf } = require('../../services/pdf/pdfDocumentService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * Extract the authenticated user id from the session.
 * @param {import('express').Request} req
 * @returns {number|string}
 */
function userIdFromReq(req) {
  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (err?.status && err?.code) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await accountReservationService.getDashboard(userIdFromReq(req));
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.getDashboard',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the reservations constant.
    const reservations = await accountReservationService.listReservations(userIdFromReq(req));
    // Return the resulting value to the caller.
    return apiResponse.success(res, { reservations });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.listReservations',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the reservation constant.
    const reservation = await accountReservationService.getReservationDetail(
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { reservation });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.getReservation',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the reservation constant.
    const reservation = await accountReservationService.updateTravel(
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      {
        // Provide the flight number field value.
        flightNumber: req.body.flightNumber,
        // Provide the hotel name field value.
        hotelName: req.body.hotelName,
        // Provide the address field value.
        address: req.body.address,
        // Provide the special requests field value.
        specialRequests: req.body.specialRequests,
      }
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { reservation });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.updateTravel',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await accountReservationService.requestCancellation(
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body.reason
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, result);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.requestCancellation',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the documents constant.
    const documents = await accountDocumentService.listDocuments(userIdFromReq(req));
    // Return the resulting value to the caller.
    return apiResponse.success(res, { documents });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.listDocuments',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the document constant.
    const document = await accountDocumentService.uploadDocument(userIdFromReq(req), {
      // Provide the file field value.
      file: req.file,
      // Provide the doc type field value.
      docType: req.body.docType,
      // Provide the reservation id field value.
      reservationId: req.body.reservationId,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { document }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.uploadDocument',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { document, stream } = await accountDocumentService.openDocumentDownload(
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id
    );
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    // Call res.setHeader to perform this step.
    res.setHeader(
      // Supply the literal value used by the enclosing expression.
      'Content-Disposition',
      // Continue the surrounding logic with this statement.
      `attachment; filename="${encodeURIComponent(document.originalFilename || 'document')}"`
    );
    // Call stream.pipe to perform this step.
    stream.pipe(res);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.downloadDocument',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the document constant.
    const document = await accountDocumentService.deleteDocument(
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { document });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.deleteDocument',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the reservation constant.
    const reservation = await accountReservationService.getReservationForPdf(
      // Call userIdFromReq to perform this step.
      userIdFromReq(req),
      // Contribute this line to the enclosing declaration or statement.
      req.params.id
    );
    // Destructure object properties into local variables.
    const { buffer, filename, contentType } = await generatePdf(req.params.kind, reservation);
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Type', contentType);
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Return the resulting value to the caller.
    return res.send(buffer);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.account.downloadPdf',
      // Provide the public message field value.
      publicMessage: 'Error generating PDF.',
    });
  }
});
