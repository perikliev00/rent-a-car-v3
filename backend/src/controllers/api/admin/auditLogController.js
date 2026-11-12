/**
 * Admin audit-log listing handler.
 */
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const { listAuditLogs } = require('../../../services/admin/adminAuditService');
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
 * List audit log entries with query filters.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Query: from, to, actorType, action*, entity*, page, limit
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listAuditLogs = asyncHandler(async (req, res, next) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await listAuditLogs({
      // Provide the from field value.
      from: req.query.from || null,
      // Provide the to field value.
      to: req.query.to || null,
      // Provide the actor type field value.
      actorType: req.query.actorType || null,
      // Provide the action prefix field value.
      actionPrefix: req.query.actionPrefix || null,
      // Provide the action field value.
      action: req.query.action || null,
      // Provide the admin user id field value.
      adminUserId: req.query.adminUserId || null,
      // Provide the entity type field value.
      entityType: req.query.entityType || null,
      // Provide the entity id field value.
      entityId: req.query.entityId || null,
      // Provide the page field value.
      page: req.query.page != null ? Number(req.query.page) : 1,
      // Provide the limit field value.
      limit: req.query.limit != null ? Number(req.query.limit) : 50,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listAdminAuditLogs',
      // Provide the public message field value.
      publicMessage: 'Error loading audit logs.',
    });
  }
});
