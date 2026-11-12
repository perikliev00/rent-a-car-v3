/**
 * HTTP handlers for admin analytics endpoints (JSON + CSV export).
 */

const analyticsService = require('./analytics.service');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/** Minimal session access object for RBAC money/export checks. */
function sessionAccess(req) {
  // Return the resulting value to the caller.
  return {
    // Provide the roles field value.
    roles: req.session?.user?.roles || [],
    // Provide the permissions field value.
    permissions: req.session?.user?.permissions || [],
  };
}

/**
 * Map known service errors (status+code) to API error responses.
 * @param {Error} err
 * @param {import('express').Response} res
 * @returns {object|null} Response if mapped; null to fall through to forwardControllerError
 */
function mapServiceError(err, res) {
  // Evaluate the condition and enter the branch when it is true.
  if (err?.status && err?.code) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  // Return the resulting value to the caller.
  return null;
}

/** GET analytics overview KPIs + series. */
exports.getOverview = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getOverview({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getOverview',
      // Provide the public message field value.
      publicMessage: 'Error loading analytics overview.',
    });
  }
});

/** GET revenue breakdown by car. */
exports.getRevenueByCar = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getRevenueByCar({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getRevenueByCar',
      // Provide the public message field value.
      publicMessage: 'Error loading revenue by car.',
    });
  }
});

/** GET revenue breakdown by pickup location. */
exports.getRevenueByLocation = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getRevenueByLocation({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getRevenueByLocation',
      // Provide the public message field value.
      publicMessage: 'Error loading revenue by location.',
    });
  }
});

/** GET per-car utilization (no money fields). */
exports.getUtilization = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getUtilization({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getUtilization',
      // Provide the public message field value.
      publicMessage: 'Error loading utilization.',
    });
  }
});

/** GET fleet car performance table. */
exports.getCarsPerformance = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getCarsPerformance({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getCarsPerformance',
      // Provide the public message field value.
      publicMessage: 'Error loading car performance.',
    });
  }
});

/** GET single-car performance detail. */
exports.getCarPerformance = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await analyticsService.getCarPerformance({
      // Provide the car id field value.
      carId: Number(req.params.carId),
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.getCarPerformance',
      // Provide the public message field value.
      publicMessage: 'Error loading car performance.',
    });
  }
});

/** GET CSV export of car performance (requires export permission). */
exports.exportCsv = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the csv constant.
    const csv = await analyticsService.exportCsv({
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the access field value.
      access: sessionAccess(req),
    });
    // Force download with a date-stamped filename for the selected range.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Call res.setHeader to perform this step.
    res.setHeader(
      // Supply the literal value used by the enclosing expression.
      'Content-Disposition',
      // Continue the surrounding logic with this statement.
      `attachment; filename="analytics-${req.query.from}-${req.query.to}.csv"`
    );
    // Return the resulting value to the caller.
    return res.status(200).send(csv);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.analytics.exportCsv',
      // Provide the public message field value.
      publicMessage: 'Error exporting analytics.',
    });
  }
});
