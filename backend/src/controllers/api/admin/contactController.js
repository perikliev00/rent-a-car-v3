/**
 * Admin contact-message list, status update, and delete handlers.
 */
const { validationResult } = require('express-validator');
const contactSql = require('../../../services/sql/contactSqlService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for validation failures.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

/**
 * List contact-form messages for the admin inbox.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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

/**
 * Update status of a contact message and audit the change.
 * Side effects: updates contact row; writes admin audit log.
 * @param {import('express').Request} req - Params: id; body: status
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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

/**
 * Delete a contact message and audit the deletion.
 * Side effects: deletes contact row; writes admin audit log.
 * @param {import('express').Request} req - Params: id
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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
