const accountReservationService = require('../../services/account/accountReservationService');
const accountDocumentService = require('../../services/account/accountDocumentService');
const reservationClaimService = require('../../services/account/reservationClaimService');
const { generatePdf } = require('../../services/pdf/pdfDocumentService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

function userIdFromReq(req) {
  return req.session.user.id;
}

function sessionUser(req) {
  return req.session.user;
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

const { OUTCOMES } = reservationClaimService;

exports.claimReservation = asyncHandler(async (req, res, next) => {
  try {
    const result = await reservationClaimService.claimReservation({
      user: sessionUser(req),
      reservationId: req.params.id,
      rawToken: req.body.token,
      ipAddress: req.ip,
    });

    if (result.outcome === OUTCOMES.CLAIMED || result.outcome === OUTCOMES.ALREADY_OWNED) {
      return apiResponse.success(res, {
        reservationId: String(result.reservationId),
        claimed: true,
        alreadyOwned: result.outcome === OUTCOMES.ALREADY_OWNED,
      });
    }

    if (result.outcome === OUTCOMES.CONFLICT) {
      return apiResponse.error(
        res,
        'CLAIM_CONFLICT',
        'This booking is already linked to another account. Contact support if this is unexpected.',
        409
      );
    }

    // Invalid token, expired token, wrong reservation and email mismatch all return the
    // same shape so a caller cannot map out which reservations or tokens exist.
    return apiResponse.error(
      res,
      'CLAIM_TOKEN_INVALID',
      'This claim link is not valid for your account. Request a new one.',
      400
    );
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.claimReservation',
      publicMessage: 'Error linking this booking to your account.',
    });
  }
});

exports.requestClaimToken = asyncHandler(async (req, res, next) => {
  try {
    await reservationClaimService.requestClaimToken({
      user: sessionUser(req),
      reservationId: req.body.reservationId,
      bookingEmail: req.body.bookingEmail,
    });

    // Uniform response regardless of whether anything was sent, so this cannot be used to
    // discover which reservation ids or emails exist.
    return apiResponse.success(res, { requested: true });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.account.requestClaimToken',
      publicMessage: 'Error requesting a claim link.',
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
