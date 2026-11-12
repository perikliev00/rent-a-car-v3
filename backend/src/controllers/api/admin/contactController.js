/**
 * Admin contact-message list, status update, and delete handlers.
 */
const { validationResult } = require('express-validator');
// Require the '../../../services/sql/contactSqlService' module as contactSql.
const contactSql = require('../../../services/sql/contactSqlService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../services/admin/adminAuditService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for validation failures.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  // Return the resulting value to the caller.
  return apiResponse.error(
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Supply the literal value used by the enclosing expression.
    'VALIDATION_ERROR',
    // Call errors.array to perform this step.
    errors.array()[0].msg,
    // Supply the literal value used by the enclosing expression.
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
  // Start a try block for operations that may fail.
  try {
    // Create the contacts constant.
    const contacts = await contactSql.listContacts();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { contacts });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listAdminContacts',
      // Provide the public message field value.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the contact constant.
    const contact = await contactSql.updateContactStatus(req.params.id, req.body.status);
    // Evaluate the condition and enter the branch when it is true.
    if (!contact) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Contact not found.', 404);
    }
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.updated_contact_status',
      // Provide the entity type field value.
      entityType: 'contact',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { status: req.body.status },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { contact });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.message === 'Invalid contact status') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', err.message, 422);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.updateContactStatus',
      // Provide the public message field value.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the deleted constant.
    const deleted = await contactSql.deleteContactById(req.params.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!deleted) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Contact not found.', 404);
    }
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.deleted_contact',
      // Provide the entity type field value.
      entityType: 'contact',
      // Provide the entity id field value.
      entityId: req.params.id,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.deleteContact',
      // Provide the public message field value.
      publicMessage: 'Error deleting contact.',
    });
  }
});
