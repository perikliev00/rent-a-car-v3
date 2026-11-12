/**
 * Admin pricing configuration and quote preview handlers.
 */
const pricingAdminService = require('../../../services/admin/pricingAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../services/admin/adminAuditService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * Return full pricing configuration. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getPricing = asyncHandler(async (_req, res) => {
  // Create the pricing constant.
  const pricing = await pricingAdminService.getPricingBundle();
  // Return the resulting value to the caller.
  return apiResponse.success(res, { pricing });
});

/**
 * Update delivery fee configuration. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateDeliveryFees = asyncHandler(async (req, res) => {
  // Create the fees constant.
  const fees = Array.isArray(req.body?.fees) ? req.body.fees : [];
  // Create the updated constant.
  const updated = await pricingAdminService.saveDeliveryFees(
    // Call fees.map to perform this step.
    fees.map((f) => ({ locationId: f.locationId, fee: Number(f.fee) || 0 }))
  );
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_delivery_fees',
    // Provide the entity type field value.
    entityType: 'pricing',
    // Provide the metadata field value.
    metadata: { count: updated.length },
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { deliveryFees: updated });
});

/**
 * Update a single global fee by key. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateGlobalFee = asyncHandler(async (req, res) => {
  // Create the fee key constant.
  const feeKey = req.params.feeKey;
  // Create the updated constant.
  const updated = await pricingAdminService.saveGlobalFee(feeKey, {
    // Provide the label field value.
    label: req.body.label,
    // Provide the amount field value.
    amount: Number(req.body.amount) || 0,
    // Provide the mode field value.
    mode: req.body.mode || 'flat',
    // Provide the active field value.
    active: req.body.active !== false,
  });
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_global_fee',
    // Provide the entity type field value.
    entityType: 'pricing',
    // Provide the metadata field value.
    metadata: { feeKey },
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { globalFee: updated });
});

/**
 * Create a pricing season. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createSeason = asyncHandler(async (req, res) => {
  // Create the season constant.
  const season = await pricingAdminService.createSeason({
    // Provide the name field value.
    name: req.body.name,
    // Provide the start month field value.
    startMonth: Number(req.body.startMonth),
    // Provide the start day field value.
    startDay: Number(req.body.startDay),
    // Provide the end month field value.
    endMonth: Number(req.body.endMonth),
    // Provide the end day field value.
    endDay: Number(req.body.endDay),
    // Provide the adj type field value.
    adjType: req.body.adjType || 'percent',
    // Provide the adj value field value.
    adjValue: Number(req.body.adjValue) || 0,
    // Provide the active field value.
    active: req.body.active !== false,
  });
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.created_pricing_season',
    // Provide the entity type field value.
    entityType: 'pricing_season',
    // Provide the entity id field value.
    entityId: season.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { season }, 201);
});

/**
 * Update a pricing season. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateSeason = asyncHandler(async (req, res) => {
  // Create the season constant.
  const season = await pricingAdminService.updateSeason(Number(req.params.id), {
    // Provide the name field value.
    name: req.body.name,
    // Provide the start month field value.
    startMonth: Number(req.body.startMonth),
    // Provide the start day field value.
    startDay: Number(req.body.startDay),
    // Provide the end month field value.
    endMonth: Number(req.body.endMonth),
    // Provide the end day field value.
    endDay: Number(req.body.endDay),
    // Provide the adj type field value.
    adjType: req.body.adjType || 'percent',
    // Provide the adj value field value.
    adjValue: Number(req.body.adjValue) || 0,
    // Provide the active field value.
    active: req.body.active !== false,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!season) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Season not found', 404);
  }
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_season',
    // Provide the entity type field value.
    entityType: 'pricing_season',
    // Provide the entity id field value.
    entityId: season.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { season });
});

/**
 * Delete a pricing season. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.deleteSeason = asyncHandler(async (req, res) => {
  // Create the ok constant.
  const ok = await pricingAdminService.deleteSeason(Number(req.params.id));
  // Evaluate the condition and enter the branch when it is true.
  if (!ok) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Season not found', 404);
  }
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.deleted_pricing_season',
    // Provide the entity type field value.
    entityType: 'pricing_season',
    // Provide the entity id field value.
    entityId: Number(req.params.id),
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { deleted: true });
});

/**
 * Update weekend pricing multipliers. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateWeekend = asyncHandler(async (req, res) => {
  // Create the id constant.
  const id = req.body.id ? Number(req.body.id) : null;
  // Create the rule constant.
  const rule = await pricingAdminService.saveWeekendRule(id, {
    // Provide the name field value.
    name: req.body.name,
    // Provide the weekdays field value.
    weekdays: req.body.weekdays,
    // Provide the adj type field value.
    adjType: req.body.adjType || 'percent',
    // Provide the adj value field value.
    adjValue: Number(req.body.adjValue) || 0,
    // Provide the active field value.
    active: req.body.active !== false,
  });
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_weekend',
    // Provide the entity type field value.
    entityType: 'pricing_weekend',
    // Provide the entity id field value.
    entityId: rule?.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { weekendRule: rule });
});

/**
 * Update a discount rule. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateDiscount = asyncHandler(async (req, res) => {
  // Create the rule constant.
  const rule = await pricingAdminService.updateDiscount(Number(req.params.id), {
    // Provide the name field value.
    name: req.body.name,
    // Provide the threshold field value.
    threshold: req.body.threshold != null ? Number(req.body.threshold) : undefined,
    // Provide the adj type field value.
    adjType: req.body.adjType,
    // Provide the adj value field value.
    adjValue: req.body.adjValue != null ? Number(req.body.adjValue) : undefined,
    // Provide the active field value.
    active: req.body.active,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!rule) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Discount rule not found', 404);
  }
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_discount',
    // Provide the entity type field value.
    entityType: 'pricing_discount',
    // Provide the entity id field value.
    entityId: rule.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { discountRule: rule });
});

/**
 * Update deposit configuration. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateDeposit = asyncHandler(async (req, res) => {
  // Create the id constant.
  const id = req.body.id ? Number(req.body.id) : null;
  // Create the rule constant.
  const rule = await pricingAdminService.saveDeposit(id, {
    // Provide the name field value.
    name: req.body.name,
    // Provide the default amount field value.
    defaultAmount: Number(req.body.defaultAmount) || 0,
    // Provide the active field value.
    active: req.body.active !== false,
  });
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_deposit',
    // Provide the entity type field value.
    entityType: 'pricing_deposit',
    // Provide the entity id field value.
    entityId: rule?.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { depositRule: rule });
});

/**
 * Create a bookable extra. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createExtra = asyncHandler(async (req, res) => {
  // Create the extra constant.
  const extra = await pricingAdminService.createExtra({
    // Provide the code field value.
    code: req.body.code,
    // Provide the label field value.
    label: req.body.label,
    // Provide the mode field value.
    mode: req.body.mode || 'flat',
    // Provide the amount field value.
    amount: Number(req.body.amount) || 0,
    // Provide the active field value.
    active: req.body.active !== false,
    // Provide the sort order field value.
    sortOrder: Number(req.body.sortOrder) || 0,
  });
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.created_pricing_extra',
    // Provide the entity type field value.
    entityType: 'pricing_extra',
    // Provide the entity id field value.
    entityId: extra.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { extra }, 201);
});

/**
 * Update a bookable extra. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateExtra = asyncHandler(async (req, res) => {
  // Create the extra constant.
  const extra = await pricingAdminService.updateExtra(Number(req.params.id), {
    // Provide the label field value.
    label: req.body.label,
    // Provide the mode field value.
    mode: req.body.mode,
    // Provide the amount field value.
    amount: req.body.amount != null ? Number(req.body.amount) : undefined,
    // Provide the active field value.
    active: req.body.active,
    // Provide the sort order field value.
    sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) : undefined,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!extra) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Extra not found', 404);
  }
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.updated_pricing_extra',
    // Provide the entity type field value.
    entityType: 'pricing_extra',
    // Provide the entity id field value.
    entityId: extra.id,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { extra });
});

/**
 * Delete a bookable extra. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.deleteExtra = asyncHandler(async (req, res) => {
  // Create the ok constant.
  const ok = await pricingAdminService.deleteExtra(Number(req.params.id));
  // Evaluate the condition and enter the branch when it is true.
  if (!ok) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Extra not found', 404);
  }
  // Record an admin audit entry for this mutation.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.deleted_pricing_extra',
    // Provide the entity type field value.
    entityType: 'pricing_extra',
    // Provide the entity id field value.
    entityId: Number(req.params.id),
  });
  // Return the resulting value to the caller.
  return apiResponse.success(res, { deleted: true });
});

/**
 * Preview a price quote for given inputs. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.preview = asyncHandler(async (req, res) => {
  // Create the result constant.
  const result = await pricingAdminService.previewPricing(req.body);
  // Evaluate the condition and enter the branch when it is true.
  if (!result.ok) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'PRICING_PREVIEW_FAILED', result.error, result.status || 400);
  }
  // Return the resulting value to the caller.
  return apiResponse.success(res, { car: result.car, pricing: result.pricing });
});
