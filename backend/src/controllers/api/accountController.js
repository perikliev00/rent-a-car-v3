const accountReservationService = require('../../services/account/accountReservationService');
const accountDocumentService = require('../../services/account/accountDocumentService');
const { generatePdf } = require('../../services/pdf/pdfDocumentService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

function userIdFromReq(req) {
  return req.session.user.id;
}

function respondServiceError(res, err) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

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
