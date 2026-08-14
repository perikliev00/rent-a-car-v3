const pricingAdminService = require('../../../services/admin/pricingAdminService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');

exports.getPricing = asyncHandler(async (_req, res) => {
  const pricing = await pricingAdminService.getPricingBundle();
  return apiResponse.success(res, { pricing });
});

exports.updateDeliveryFees = asyncHandler(async (req, res) => {
  const fees = Array.isArray(req.body?.fees) ? req.body.fees : [];
  const updated = await pricingAdminService.saveDeliveryFees(
    fees.map((f) => ({ locationId: f.locationId, fee: Number(f.fee) || 0 }))
  );
  await logAdminAction(req, {
    action: 'admin.updated_pricing_delivery_fees',
    entityType: 'pricing',
    metadata: { count: updated.length },
  });
  return apiResponse.success(res, { deliveryFees: updated });
});

exports.updateGlobalFee = asyncHandler(async (req, res) => {
  const feeKey = req.params.feeKey;
  const updated = await pricingAdminService.saveGlobalFee(feeKey, {
    label: req.body.label,
    amount: Number(req.body.amount) || 0,
    mode: req.body.mode || 'flat',
    active: req.body.active !== false,
  });
  await logAdminAction(req, {
    action: 'admin.updated_pricing_global_fee',
    entityType: 'pricing',
    metadata: { feeKey },
  });
  return apiResponse.success(res, { globalFee: updated });
});

exports.createSeason = asyncHandler(async (req, res) => {
  const season = await pricingAdminService.createSeason({
    name: req.body.name,
    startMonth: Number(req.body.startMonth),
    startDay: Number(req.body.startDay),
    endMonth: Number(req.body.endMonth),
    endDay: Number(req.body.endDay),
    adjType: req.body.adjType || 'percent',
    adjValue: Number(req.body.adjValue) || 0,
    active: req.body.active !== false,
  });
  await logAdminAction(req, {
    action: 'admin.created_pricing_season',
    entityType: 'pricing_season',
    entityId: season.id,
  });
  return apiResponse.success(res, { season }, 201);
});

exports.updateSeason = asyncHandler(async (req, res) => {
  const season = await pricingAdminService.updateSeason(Number(req.params.id), {
    name: req.body.name,
    startMonth: Number(req.body.startMonth),
    startDay: Number(req.body.startDay),
    endMonth: Number(req.body.endMonth),
    endDay: Number(req.body.endDay),
    adjType: req.body.adjType || 'percent',
    adjValue: Number(req.body.adjValue) || 0,
    active: req.body.active !== false,
  });
  if (!season) {
    return apiResponse.error(res, 'NOT_FOUND', 'Season not found', 404);
  }
  await logAdminAction(req, {
    action: 'admin.updated_pricing_season',
    entityType: 'pricing_season',
    entityId: season.id,
  });
  return apiResponse.success(res, { season });
});

exports.deleteSeason = asyncHandler(async (req, res) => {
  const ok = await pricingAdminService.deleteSeason(Number(req.params.id));
  if (!ok) {
    return apiResponse.error(res, 'NOT_FOUND', 'Season not found', 404);
  }
  await logAdminAction(req, {
    action: 'admin.deleted_pricing_season',
    entityType: 'pricing_season',
    entityId: Number(req.params.id),
  });
  return apiResponse.success(res, { deleted: true });
});

exports.updateWeekend = asyncHandler(async (req, res) => {
  const id = req.body.id ? Number(req.body.id) : null;
  const rule = await pricingAdminService.saveWeekendRule(id, {
    name: req.body.name,
    weekdays: req.body.weekdays,
    adjType: req.body.adjType || 'percent',
    adjValue: Number(req.body.adjValue) || 0,
    active: req.body.active !== false,
  });
  await logAdminAction(req, {
    action: 'admin.updated_pricing_weekend',
    entityType: 'pricing_weekend',
    entityId: rule?.id,
  });
  return apiResponse.success(res, { weekendRule: rule });
});

exports.updateDiscount = asyncHandler(async (req, res) => {
  const rule = await pricingAdminService.updateDiscount(Number(req.params.id), {
    name: req.body.name,
    threshold: req.body.threshold != null ? Number(req.body.threshold) : undefined,
    adjType: req.body.adjType,
    adjValue: req.body.adjValue != null ? Number(req.body.adjValue) : undefined,
    active: req.body.active,
  });
  if (!rule) {
    return apiResponse.error(res, 'NOT_FOUND', 'Discount rule not found', 404);
  }
  await logAdminAction(req, {
    action: 'admin.updated_pricing_discount',
    entityType: 'pricing_discount',
    entityId: rule.id,
  });
  return apiResponse.success(res, { discountRule: rule });
});

exports.updateDeposit = asyncHandler(async (req, res) => {
  const id = req.body.id ? Number(req.body.id) : null;
  const rule = await pricingAdminService.saveDeposit(id, {
    name: req.body.name,
    defaultAmount: Number(req.body.defaultAmount) || 0,
    active: req.body.active !== false,
  });
  await logAdminAction(req, {
    action: 'admin.updated_pricing_deposit',
    entityType: 'pricing_deposit',
    entityId: rule?.id,
  });
  return apiResponse.success(res, { depositRule: rule });
});

exports.createExtra = asyncHandler(async (req, res) => {
  const extra = await pricingAdminService.createExtra({
    code: req.body.code,
    label: req.body.label,
    mode: req.body.mode || 'flat',
    amount: Number(req.body.amount) || 0,
    active: req.body.active !== false,
    sortOrder: Number(req.body.sortOrder) || 0,
  });
  await logAdminAction(req, {
    action: 'admin.created_pricing_extra',
    entityType: 'pricing_extra',
    entityId: extra.id,
  });
  return apiResponse.success(res, { extra }, 201);
});

exports.updateExtra = asyncHandler(async (req, res) => {
  const extra = await pricingAdminService.updateExtra(Number(req.params.id), {
    label: req.body.label,
    mode: req.body.mode,
    amount: req.body.amount != null ? Number(req.body.amount) : undefined,
    active: req.body.active,
    sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) : undefined,
  });
  if (!extra) {
    return apiResponse.error(res, 'NOT_FOUND', 'Extra not found', 404);
  }
  await logAdminAction(req, {
    action: 'admin.updated_pricing_extra',
    entityType: 'pricing_extra',
    entityId: extra.id,
  });
  return apiResponse.success(res, { extra });
});

exports.deleteExtra = asyncHandler(async (req, res) => {
  const ok = await pricingAdminService.deleteExtra(Number(req.params.id));
  if (!ok) {
    return apiResponse.error(res, 'NOT_FOUND', 'Extra not found', 404);
  }
  await logAdminAction(req, {
    action: 'admin.deleted_pricing_extra',
    entityType: 'pricing_extra',
    entityId: Number(req.params.id),
  });
  return apiResponse.success(res, { deleted: true });
});

exports.preview = asyncHandler(async (req, res) => {
  const result = await pricingAdminService.previewPricing(req.body);
  if (!result.ok) {
    return apiResponse.error(res, 'PRICING_PREVIEW_FAILED', result.error, result.status || 400);
  }
  return apiResponse.success(res, { car: result.car, pricing: result.pricing });
});
