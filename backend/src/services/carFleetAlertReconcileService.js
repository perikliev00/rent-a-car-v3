/**
 * Reconciles fleet compliance/damage alerts into the alert store.
 * Desired set is computed from live compliance + unresolved damage; active
 * alerts not in that set are resolved. Missing tables (42P01) are skipped
 * so environments mid-migration do not crash the job.
 */
const { clientQuery } = require('../db/transaction');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_TYPE_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_COMPLIANCE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
// Continue the surrounding logic with this statement.
} = require('../constants/carEnums');
// Require the './sql/carFleetAlertStoreSqlService' module as storeSql.
const storeSql = require('./sql/carFleetAlertStoreSqlService');

/** Maps compliance item_type → alert type prefix (insurance_expired, etc.). */
const ITEM_TYPE_TO_PREFIX = {
  // Provide the civil insurance field value.
  civil_insurance: 'insurance',
  // Provide the casco field value.
  casco: 'casco',
  // Provide the vignette field value.
  vignette: 'vignette',
  // Provide the technical inspection field value.
  technical_inspection: 'inspection',
};

/** Normalize Date/string to YYYY-MM-DD for day-level expiry math. */
function toDateOnly(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Create the str constant.
  const str = String(value);
  // Return the resulting value to the caller.
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/** Whole UTC calendar days from todayStr to expiresAtStr. */
function daysUntilExpiry(todayStr, expiresAtStr) {
  // Create the a constant.
  const a = new Date(`${todayStr}T00:00:00Z`);
  // Create the b constant.
  const b = new Date(`${expiresAtStr}T00:00:00Z`);
  // Return the resulting value to the caller.
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * compliance label.
 * @param {*} itemType
 * @param {*} title
 * @returns {*}
 */
function complianceLabel(itemType, title) {
  // Return the resulting value to the caller.
  return title || COMPLIANCE_TYPE_LABELS[itemType] || itemType;
}

/**
 * Pure: map a compliance row + today into a desired alert, or null if ok.
 */
function desiredAlertFromCompliance(row, todayStr) {
  // Create the item type constant.
  const itemType = row.item_type;
  // Create the prefix constant.
  const prefix = ITEM_TYPE_TO_PREFIX[itemType];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!prefix) return null;

  // Create the car id constant.
  const carId = String(row.car_id);
  // Create the car name constant.
  const carName = row.car_name || `Car #${carId}`;
  // Create the source id constant.
  const sourceId = Number(row.id);
  // Create the label constant.
  const label = complianceLabel(itemType, row.title);
  // Create the expires constant.
  const expires = toDateOnly(row.expires_at);

  // Status / lifecycle guard before mutating domain state.
  if (row.status === 'missing') {
    // Return the resulting value to the caller.
    return null;
  }

  // Status / lifecycle guard before mutating domain state.
  if (row.status === 'expired' || (expires && expires < todayStr)) {
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the type field value.
      type: `${prefix}_expired`,
      // Provide the severity field value.
      severity: 'critical',
      // Provide the source kind field value.
      sourceKind: 'compliance_item',
      // Contribute this line to the enclosing declaration or statement.
      sourceId,
      // Provide the message field value.
      message: expires ? `${label} expired on ${expires}` : `${label} is expired`,
      // Provide the meta field value.
      meta: { itemId: sourceId, itemType, date: expires },
    };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (expires) {
    // Create the days constant.
    const days = daysUntilExpiry(todayStr, expires);
    // Evaluate the condition and enter the branch when it is true.
    if (days >= 0 && days <= FLEET_ALERT_EXPIRY_WINDOW_DAYS) {
      // Return the resulting value to the caller.
      return {
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        carName,
        // Provide the type field value.
        type: `${prefix}_expiring_soon`,
        // Provide the severity field value.
        severity: 'warning',
        // Provide the source kind field value.
        sourceKind: 'compliance_item',
        // Contribute this line to the enclosing declaration or statement.
        sourceId,
        // Provide the message field value.
        message: `${label} expires in ${days} day(s) (${expires})`,
        // Provide the meta field value.
        meta: { itemId: sourceId, itemType, date: expires, daysUntil: days },
      };
    }
  }

  // Return the resulting value to the caller.
  return null;
}

/** Build an unresolved-damage alert DTO from a damage_report row. */
function desiredAlertFromDamage(row) {
  // Create the car id constant.
  const carId = String(row.car_id);
  // Create the car name constant.
  const carName = row.car_name || `Car #${carId}`;
  // Create the source id constant.
  const sourceId = Number(row.id);
  // Create the desc constant.
  const desc = (row.description || '').trim();
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    carName,
    // Provide the type field value.
    type: 'unresolved_damage',
    // Provide the severity field value.
    severity: 'warning',
    // Provide the source kind field value.
    sourceKind: 'damage_report',
    // Contribute this line to the enclosing declaration or statement.
    sourceId,
    // Provide the message field value.
    message: desc
      // Continue the surrounding logic with this statement.
      ? `Unresolved damage: ${desc.slice(0, 120)}`
      // Contribute this line to the enclosing declaration or statement.
      : 'Unresolved damage report',
    // Provide the meta field value.
    meta: { reportId: sourceId },
  };
}

/** Compliance rows for non-deleted cars filtered to tracked alert types. */
async function loadTrackedComplianceRows(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      i.id,
      i.car_id,
      c.name AS car_name,
      i.item_type,
      i.title,
      i.expires_at,
      i.status
    FROM car_compliance_items i
    INNER JOIN cars c ON c.id = i.car_id
    WHERE c.is_deleted = FALSE
      AND i.item_type = ANY($1::text[])
    ORDER BY c.name ASC, i.id ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [FLEET_ALERT_COMPLIANCE_TYPES]
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/** Unresolved damage reports on non-deleted cars. */
async function loadUnresolvedDamages(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      d.id,
      d.car_id,
      c.name AS car_name,
      d.description,
      d.status
    FROM car_damage_reports d
    INNER JOIN cars c ON c.id = d.car_id
    WHERE c.is_deleted = FALSE
      AND d.status = 'unresolved'
    ORDER BY c.name ASC, d.id ASC
    `
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/**
 * Build the full desired active-alert set for a given clock.
 * @param {{ now?: Date|string, complianceRows?: object[], damageRows?: object[] }} opts
 */
function buildDesiredAlerts({
  // Update now with the right-hand side value.
  now = new Date(),
  // Update complianceRows with the right-hand side value.
  complianceRows = [],
  // Update damageRows with the right-hand side value.
  damageRows = [],
// Continue the surrounding logic with this statement.
} = {}) {
  // Create the today str constant.
  const todayStr = toDateOnly(now instanceof Date ? now : new Date(now)) ||
    // Continue the surrounding logic with this statement.
    new Date().toISOString().slice(0, 10);

  // Create the desired constant.
  const desired = [];
  // Iterate using the loop initializer, condition, and step.
  for (const row of complianceRows) {
    // Create the alert constant.
    const alert = desiredAlertFromCompliance(row, todayStr);
    // Evaluate the condition and enter the branch when it is true.
    if (alert) desired.push(alert);
  }
  // Iterate using the loop initializer, condition, and step.
  for (const row of damageRows) {
    // Call desired.push to perform this step.
    desired.push(desiredAlertFromDamage(row));
  }
  // Return the resulting value to the caller.
  return { todayStr, desired };
}

/**
 * Upsert desired alerts and resolve stale active ones.
 * @param {{ now?: Date|string, client?: object }} opts
 */
async function reconcileFleetAlerts({ now = new Date(), client = null } = {}) {
  // Initialize the mutable compliance rows variable.
  let complianceRows = [];
  // Initialize the mutable damage rows variable.
  let damageRows = [];

  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in complianceRows.
    complianceRows = await loadTrackedComplianceRows(client);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // 42P01 = undefined_table — tolerate missing migrations during deploy.
    if (err?.code !== '42P01') throw err;
  }

  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in damageRows.
    damageRows = await loadUnresolvedDamages(client);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err?.code !== '42P01') throw err;
  }

  // Destructure object properties into local variables.
  const { todayStr, desired } = buildDesiredAlerts({
    // Contribute this line to the enclosing declaration or statement.
    now,
    // Contribute this line to the enclosing declaration or statement.
    complianceRows,
    // Contribute this line to the enclosing declaration or statement.
    damageRows,
  });

  // Create the keep keys constant.
  const keepKeys = new Set();
  // Initialize the mutable upserted variable.
  let upserted = 0;

  // Iterate using the loop initializer, condition, and step.
  for (const alert of desired) {
    // Call keepKeys.add to perform this step.
    keepKeys.add(storeSql.alertKey(alert));
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await storeSql.upsertActive(alert, client);
      // Update upserted with the right-hand side value.
      upserted += 1;
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err?.code === '42P01') {
        // Return the resulting value to the caller.
        return { todayStr, upserted: 0, resolved: 0, desired: desired.length, skipped: true };
      }
      // Throw an error to stop the current control flow.
      throw err;
    }
  }

  // Initialize the mutable resolved variable.
  let resolved = 0;
  // Protected block: isolate failure modes.
  try {
    // Anything still active but not in keepKeys is no longer warranted.
    resolved = await storeSql.resolveMissing(
      // Contribute this line to the enclosing declaration or statement.
      keepKeys,
      // Continue the surrounding logic with this statement.
      now instanceof Date ? now : new Date(now),
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err?.code !== '42P01') throw err;
  }

  // Return the resulting value to the caller.
  return { todayStr, upserted, resolved, desired: desired.length, skipped: false };
}

/** Cron/job entry: reconcile and log only when something changed. */
async function runFleetAlertChecks() {
  // Protected block: isolate failure modes.
  try {
    // Create the result constant.
    const result = await reconcileFleetAlerts({ now: new Date() });
    // Guard: early-return or throw when required input is missing/invalid.
    if (!result.skipped && (result.upserted || result.resolved)) {
      // Call logger.info to perform this step.
      logger.info(
        {
          // Provide the upserted field value.
          upserted: result.upserted,
          // Provide the resolved field value.
          resolved: result.resolved,
          // Provide the desired field value.
          desired: result.desired,
        },
        // Supply the literal value used by the enclosing expression.
        'Fleet alert reconcile completed'
      );
    }
    // Return the resulting value to the caller.
    return result;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'runFleetAlertChecks' }, 'Fleet alert reconcile error');
    // Return the resulting value to the caller.
    return null;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  toDateOnly,
  // Contribute this line to the enclosing declaration or statement.
  daysUntilExpiry,
  // Contribute this line to the enclosing declaration or statement.
  desiredAlertFromCompliance,
  // Contribute this line to the enclosing declaration or statement.
  desiredAlertFromDamage,
  // Contribute this line to the enclosing declaration or statement.
  buildDesiredAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  runFleetAlertChecks,
  // Contribute this line to the enclosing declaration or statement.
  loadTrackedComplianceRows,
  // Contribute this line to the enclosing declaration or statement.
  loadUnresolvedDamages,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
};
