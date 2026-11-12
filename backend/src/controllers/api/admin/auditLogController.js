/**
 * Admin audit-log listing handler.
 */
const { validationResult } = require('express-validator');
const { listAuditLogs } = require('../../../services/admin/adminAuditService');
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
 * List audit log entries with query filters.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Query: from, to, actorType, action*, entity*, page, limit
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listAuditLogs = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const data = await listAuditLogs({
      from: req.query.from || null,
      to: req.query.to || null,
      actorType: req.query.actorType || null,
      actionPrefix: req.query.actionPrefix || null,
      action: req.query.action || null,
      adminUserId: req.query.adminUserId || null,
      entityType: req.query.entityType || null,
      entityId: req.query.entityId || null,
      page: req.query.page != null ? Number(req.query.page) : 1,
      limit: req.query.limit != null ? Number(req.query.limit) : 50,
    });
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listAdminAuditLogs',
      publicMessage: 'Error loading audit logs.',
    });
  }
});
