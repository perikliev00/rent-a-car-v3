const { validationResult } = require('express-validator');
const contactSql = require('../../../services/sql/contactSqlService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

exports.listContacts = asyncHandler(async (req, res, next) => {
  try {
    const contacts = await contactSql.listContacts();
    return apiResponse.success(res, { contacts });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listAdminContacts',
      publicMessage: 'Error loading contacts.',
    });
  }
});

exports.updateContactStatus = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const contact = await contactSql.updateContactStatus(req.params.id, req.body.status);
    if (!contact) {
      return apiResponse.error(res, 'NOT_FOUND', 'Contact not found.', 404);
    }
    await logAdminAction(req, {
      action: 'admin.updated_contact_status',
      entityType: 'contact',
      entityId: req.params.id,
      metadata: { status: req.body.status },
    });
    return apiResponse.success(res, { contact });
  } catch (err) {
    if (err.message === 'Invalid contact status') {
      return apiResponse.error(res, 'VALIDATION_ERROR', err.message, 422);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.updateContactStatus',
      publicMessage: 'Error updating status.',
    });
  }
});

exports.deleteContact = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const deleted = await contactSql.deleteContactById(req.params.id);
    if (!deleted) {
      return apiResponse.error(res, 'NOT_FOUND', 'Contact not found.', 404);
    }
    await logAdminAction(req, {
      action: 'admin.deleted_contact',
      entityType: 'contact',
      entityId: req.params.id,
    });
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.deleteContact',
      publicMessage: 'Error deleting contact.',
    });
  }
});
