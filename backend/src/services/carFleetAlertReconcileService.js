const { clientQuery } = require('../db/transaction');
const logger = require('../utils/logger');
const {
  COMPLIANCE_TYPE_LABELS,
  FLEET_ALERT_COMPLIANCE_TYPES,
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
} = require('../constants/carEnums');
const storeSql = require('./sql/carFleetAlertStoreSqlService');

const ITEM_TYPE_TO_PREFIX = {
  civil_insurance: 'insurance',
  casco: 'casco',
  vignette: 'vignette',
  technical_inspection: 'inspection',
};

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

function daysUntilExpiry(todayStr, expiresAtStr) {
  const a = new Date(`${todayStr}T00:00:00Z`);
  const b = new Date(`${expiresAtStr}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function complianceLabel(itemType, title) {
  return title || COMPLIANCE_TYPE_LABELS[itemType] || itemType;
}

/**
 * Pure: map a compliance row + today into a desired alert, or null if ok.
 */
function desiredAlertFromCompliance(row, todayStr) {
  const itemType = row.item_type;
  const prefix = ITEM_TYPE_TO_PREFIX[itemType];
  if (!prefix) return null;

  const carId = String(row.car_id);
  const carName = row.car_name || `Car #${carId}`;
  const sourceId = Number(row.id);
  const label = complianceLabel(itemType, row.title);
  const expires = toDateOnly(row.expires_at);

  if (row.status === 'missing') {
    return null;
  }

  if (row.status === 'expired' || (expires && expires < todayStr)) {
    return {
      carId,
      carName,
      type: `${prefix}_expired`,
      severity: 'critical',
      sourceKind: 'compliance_item',
      sourceId,
      message: expires ? `${label} expired on ${expires}` : `${label} is expired`,
      meta: { itemId: sourceId, itemType, date: expires },
    };
  }

  if (expires) {
    const days = daysUntilExpiry(todayStr, expires);
    if (days >= 0 && days <= FLEET_ALERT_EXPIRY_WINDOW_DAYS) {
      return {
        carId,
        carName,
        type: `${prefix}_expiring_soon`,
        severity: 'warning',
        sourceKind: 'compliance_item',
        sourceId,
        message: `${label} expires in ${days} day(s) (${expires})`,
        meta: { itemId: sourceId, itemType, date: expires, daysUntil: days },
      };
    }
  }

  return null;
}

function desiredAlertFromDamage(row) {
  const carId = String(row.car_id);
  const carName = row.car_name || `Car #${carId}`;
  const sourceId = Number(row.id);
  const desc = (row.description || '').trim();
  return {
    carId,
    carName,
    type: 'unresolved_damage',
    severity: 'warning',
    sourceKind: 'damage_report',
    sourceId,
    message: desc
      ? `Unresolved damage: ${desc.slice(0, 120)}`
      : 'Unresolved damage report',
    meta: { reportId: sourceId },
  };
}

async function loadTrackedComplianceRows(client = null) {
  const result = await clientQuery(
    client,
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
    [FLEET_ALERT_COMPLIANCE_TYPES]
  );
  return result.rows;
}

async function loadUnresolvedDamages(client = null) {
  const result = await clientQuery(
    client,
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
  return result.rows;
}

/**
 * Build the full desired active-alert set for a given clock.
 * @param {{ now?: Date|string, complianceRows?: object[], damageRows?: object[] }} opts
 */
function buildDesiredAlerts({
  now = new Date(),
  complianceRows = [],
  damageRows = [],
} = {}) {
  const todayStr = toDateOnly(now instanceof Date ? now : new Date(now)) ||
    new Date().toISOString().slice(0, 10);

  const desired = [];
  for (const row of complianceRows) {
    const alert = desiredAlertFromCompliance(row, todayStr);
    if (alert) desired.push(alert);
  }
  for (const row of damageRows) {
    desired.push(desiredAlertFromDamage(row));
  }
  return { todayStr, desired };
}

/**
 * Upsert desired alerts and resolve stale active ones.
 * @param {{ now?: Date|string, client?: object }} opts
 */
async function reconcileFleetAlerts({ now = new Date(), client = null } = {}) {
  let complianceRows = [];
  let damageRows = [];

  try {
    complianceRows = await loadTrackedComplianceRows(client);
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }

  try {
    damageRows = await loadUnresolvedDamages(client);
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }

  const { todayStr, desired } = buildDesiredAlerts({
    now,
    complianceRows,
    damageRows,
  });

  const keepKeys = new Set();
  let upserted = 0;

  for (const alert of desired) {
    keepKeys.add(storeSql.alertKey(alert));
    try {
      await storeSql.upsertActive(alert, client);
      upserted += 1;
    } catch (err) {
      if (err?.code === '42P01') {
        return { todayStr, upserted: 0, resolved: 0, desired: desired.length, skipped: true };
      }
      throw err;
    }
  }

  let resolved = 0;
  try {
    resolved = await storeSql.resolveMissing(
      keepKeys,
      now instanceof Date ? now : new Date(now),
      client
    );
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }

  return { todayStr, upserted, resolved, desired: desired.length, skipped: false };
}

async function runFleetAlertChecks() {
  try {
    const result = await reconcileFleetAlerts({ now: new Date() });
    if (!result.skipped && (result.upserted || result.resolved)) {
      logger.info(
        {
          upserted: result.upserted,
          resolved: result.resolved,
          desired: result.desired,
        },
        'Fleet alert reconcile completed'
      );
    }
    return result;
  } catch (err) {
    logger.error({ err, context: 'runFleetAlertChecks' }, 'Fleet alert reconcile error');
    return null;
  }
}

module.exports = {
  toDateOnly,
  daysUntilExpiry,
  desiredAlertFromCompliance,
  desiredAlertFromDamage,
  buildDesiredAlerts,
  reconcileFleetAlerts,
  runFleetAlertChecks,
  loadTrackedComplianceRows,
  loadUnresolvedDamages,
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
};
