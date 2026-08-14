const analyticsService = require('./analytics.service');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

function sessionAccess(req) {
  return {
    roles: req.session?.user?.roles || [],
    permissions: req.session?.user?.permissions || [],
  };
}

function mapServiceError(err, res) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

exports.getOverview = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview({
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getOverview',
      publicMessage: 'Error loading analytics overview.',
    });
  }
});

exports.getRevenueByCar = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueByCar({
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getRevenueByCar',
      publicMessage: 'Error loading revenue by car.',
    });
  }
});

exports.getRevenueByLocation = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueByLocation({
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getRevenueByLocation',
      publicMessage: 'Error loading revenue by location.',
    });
  }
});

exports.getUtilization = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getUtilization({
      from: req.query.from,
      to: req.query.to,
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getUtilization',
      publicMessage: 'Error loading utilization.',
    });
  }
});

exports.getCarsPerformance = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getCarsPerformance({
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getCarsPerformance',
      publicMessage: 'Error loading car performance.',
    });
  }
});

exports.getCarPerformance = asyncHandler(async (req, res, next) => {
  try {
    const data = await analyticsService.getCarPerformance({
      carId: Number(req.params.carId),
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.getCarPerformance',
      publicMessage: 'Error loading car performance.',
    });
  }
});

exports.exportCsv = asyncHandler(async (req, res, next) => {
  try {
    const csv = await analyticsService.exportCsv({
      from: req.query.from,
      to: req.query.to,
      access: sessionAccess(req),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${req.query.from}-${req.query.to}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.analytics.exportCsv',
      publicMessage: 'Error exporting analytics.',
    });
  }
});
