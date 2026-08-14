const pool = require('../../db/pool');
const { DELIVERY_FEES } = require('../../constants/locations');

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapSeason(row) {
  return {
    id: Number(row.id),
    name: row.name,
    startMonth: Number(row.start_month),
    startDay: Number(row.start_day),
    endMonth: Number(row.end_month),
    endDay: Number(row.end_day),
    adjType: row.adj_type,
    adjValue: num(row.adj_value),
    active: Boolean(row.active),
  };
}

function mapWeekend(row) {
  return {
    id: Number(row.id),
    name: row.name,
    weekdays: Array.isArray(row.weekdays) ? row.weekdays.map(Number) : [5, 6, 0],
    adjType: row.adj_type,
    adjValue: num(row.adj_value),
    active: Boolean(row.active),
  };
}

function mapDiscount(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    name: row.name,
    threshold: Number(row.threshold),
    adjType: row.adj_type,
    adjValue: num(row.adj_value),
    active: Boolean(row.active),
  };
}

function mapDeposit(row) {
  return {
    id: Number(row.id),
    name: row.name,
    defaultAmount: num(row.default_amount),
    active: Boolean(row.active),
  };
}

function mapExtra(row) {
  return {
    id: Number(row.id),
    code: row.code,
    label: row.label,
    mode: row.mode,
    amount: num(row.amount),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  };
}

function mapGlobalFee(row) {
  return {
    feeKey: row.fee_key,
    label: row.label,
    amount: num(row.amount),
    mode: row.mode,
    active: Boolean(row.active),
  };
}

function fallbackDeliveryFees() {
  return Object.entries(DELIVERY_FEES).map(([locationId, fee]) => ({
    locationId,
    fee: num(fee),
  }));
}

async function loadPricingConfig() {
  const [seasons, weekends, discounts, deposits, deliveryFees, globalFees, extras] =
    await Promise.all([
      pool.query(`SELECT * FROM pricing_seasons ORDER BY id ASC`),
      pool.query(`SELECT * FROM pricing_weekend_rules ORDER BY id ASC`),
      pool.query(`SELECT * FROM pricing_discount_rules ORDER BY kind ASC, id ASC`),
      pool.query(`SELECT * FROM pricing_deposit_rules ORDER BY id ASC`),
      pool.query(`SELECT * FROM pricing_delivery_fees ORDER BY location_id ASC`),
      pool.query(`SELECT * FROM pricing_global_fees ORDER BY fee_key ASC`),
      pool.query(`SELECT * FROM pricing_extras ORDER BY sort_order ASC, id ASC`),
    ]);

  const delivery =
    deliveryFees.rows.length > 0
      ? deliveryFees.rows.map((r) => ({
          locationId: r.location_id,
          fee: num(r.fee),
        }))
      : fallbackDeliveryFees();

  const deliveryMap = Object.fromEntries(delivery.map((d) => [d.locationId, d.fee]));

  return {
    seasons: seasons.rows.map(mapSeason),
    weekendRules: weekends.rows.map(mapWeekend),
    discountRules: discounts.rows.map(mapDiscount),
    depositRules: deposits.rows.map(mapDeposit),
    deliveryFees: delivery,
    deliveryFeeMap: deliveryMap,
    globalFees: globalFees.rows.map(mapGlobalFee),
    extras: extras.rows.map(mapExtra),
  };
}

function buildDefaultConfig() {
  return {
    seasons: [],
    weekendRules: [],
    discountRules: [],
    depositRules: [{ id: 0, name: 'Default deposit', defaultAmount: 300, active: true }],
    deliveryFees: fallbackDeliveryFees(),
    deliveryFeeMap: { ...DELIVERY_FEES },
    globalFees: [
      { feeKey: 'hotel_delivery', label: 'Hotel delivery', amount: 35, mode: 'flat', active: true },
      { feeKey: 'late_return', label: 'Late return fee', amount: 50, mode: 'flat', active: true },
      { feeKey: 'fuel', label: 'Fuel fee', amount: 40, mode: 'flat', active: true },
    ],
    extras: [],
  };
}

async function upsertDeliveryFee(locationId, fee) {
  const result = await pool.query(
    `
    INSERT INTO pricing_delivery_fees (location_id, fee, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (location_id) DO UPDATE
      SET fee = EXCLUDED.fee, updated_at = NOW()
    RETURNING location_id, fee
    `,
    [locationId, fee]
  );
  return { locationId: result.rows[0].location_id, fee: num(result.rows[0].fee) };
}

async function upsertDeliveryFees(fees) {
  const out = [];
  for (const item of fees) {
    out.push(await upsertDeliveryFee(item.locationId, item.fee));
  }
  return out;
}

async function upsertGlobalFee(feeKey, { label, amount, mode, active }) {
  const result = await pool.query(
    `
    INSERT INTO pricing_global_fees (fee_key, label, amount, mode, active, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (fee_key) DO UPDATE
      SET label = EXCLUDED.label,
          amount = EXCLUDED.amount,
          mode = EXCLUDED.mode,
          active = EXCLUDED.active,
          updated_at = NOW()
    RETURNING *
    `,
    [feeKey, label, amount, mode || 'flat', active !== false]
  );
  return mapGlobalFee(result.rows[0]);
}

async function createSeason(data) {
  const result = await pool.query(
    `
    INSERT INTO pricing_seasons (
      name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
    `,
    [
      data.name,
      data.startMonth,
      data.startDay,
      data.endMonth,
      data.endDay,
      data.adjType || 'percent',
      data.adjValue,
      data.active !== false,
    ]
  );
  return mapSeason(result.rows[0]);
}

async function updateSeason(id, data) {
  const result = await pool.query(
    `
    UPDATE pricing_seasons SET
      name = $2,
      start_month = $3,
      start_day = $4,
      end_month = $5,
      end_day = $6,
      adj_type = $7,
      adj_value = $8,
      active = $9,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      data.name,
      data.startMonth,
      data.startDay,
      data.endMonth,
      data.endDay,
      data.adjType || 'percent',
      data.adjValue,
      data.active !== false,
    ]
  );
  return result.rows[0] ? mapSeason(result.rows[0]) : null;
}

async function deleteSeason(id) {
  const result = await pool.query(`DELETE FROM pricing_seasons WHERE id = $1 RETURNING id`, [id]);
  return result.rowCount > 0;
}

async function upsertWeekendRule(id, data) {
  if (id) {
    const result = await pool.query(
      `
      UPDATE pricing_weekend_rules SET
        name = $2, weekdays = $3, adj_type = $4, adj_value = $5, active = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        data.name || 'Weekend',
        data.weekdays || [5, 6, 0],
        data.adjType || 'percent',
        data.adjValue,
        data.active !== false,
      ]
    );
    return result.rows[0] ? mapWeekend(result.rows[0]) : null;
  }

  const result = await pool.query(
    `
    INSERT INTO pricing_weekend_rules (name, weekdays, adj_type, adj_value, active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      data.name || 'Weekend',
      data.weekdays || [5, 6, 0],
      data.adjType || 'percent',
      data.adjValue,
      data.active !== false,
    ]
  );
  return mapWeekend(result.rows[0]);
}

async function updateDiscountRule(id, data) {
  const result = await pool.query(
    `
    UPDATE pricing_discount_rules SET
      name = COALESCE($2, name),
      threshold = COALESCE($3, threshold),
      adj_type = COALESCE($4, adj_type),
      adj_value = COALESCE($5, adj_value),
      active = COALESCE($6, active),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, data.name, data.threshold, data.adjType, data.adjValue, data.active]
  );
  return result.rows[0] ? mapDiscount(result.rows[0]) : null;
}

async function upsertDepositRule(id, data) {
  if (id) {
    const result = await pool.query(
      `
      UPDATE pricing_deposit_rules SET
        name = $2, default_amount = $3, active = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, data.name || 'Default deposit', data.defaultAmount, data.active !== false]
    );
    return result.rows[0] ? mapDeposit(result.rows[0]) : null;
  }

  const result = await pool.query(
    `
    INSERT INTO pricing_deposit_rules (name, default_amount, active)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [data.name || 'Default deposit', data.defaultAmount, data.active !== false]
  );
  return mapDeposit(result.rows[0]);
}

async function createExtra(data) {
  const result = await pool.query(
    `
    INSERT INTO pricing_extras (code, label, mode, amount, active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      data.code,
      data.label,
      data.mode || 'flat',
      data.amount,
      data.active !== false,
      data.sortOrder ?? 0,
    ]
  );
  return mapExtra(result.rows[0]);
}

async function updateExtra(id, data) {
  const result = await pool.query(
    `
    UPDATE pricing_extras SET
      label = COALESCE($2, label),
      mode = COALESCE($3, mode),
      amount = COALESCE($4, amount),
      active = COALESCE($5, active),
      sort_order = COALESCE($6, sort_order),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, data.label, data.mode, data.amount, data.active, data.sortOrder]
  );
  return result.rows[0] ? mapExtra(result.rows[0]) : null;
}

async function deleteExtra(id) {
  const result = await pool.query(`DELETE FROM pricing_extras WHERE id = $1 RETURNING id`, [id]);
  return result.rowCount > 0;
}

module.exports = {
  loadPricingConfig,
  buildDefaultConfig,
  upsertDeliveryFee,
  upsertDeliveryFees,
  upsertGlobalFee,
  createSeason,
  updateSeason,
  deleteSeason,
  upsertWeekendRule,
  updateDiscountRule,
  upsertDepositRule,
  createExtra,
  updateExtra,
  deleteExtra,
};
