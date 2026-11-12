/**
 * SQL load/upsert for seasons, fees, extras, deposits, and discount rules.
 * Delivery fees fall back to static DELIVERY_FEES when the table is empty.
 */
const pool = require('../../db/pool');
// Destructure object properties into local variables.
const { DELIVERY_FEES } = require('../../constants/locations');

/**
 * Coerce a DB/numeric value to a finite number.
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
function num(value, fallback = 0) {
  // Create the n constant.
  const n = Number(value);
  // Return the resulting value to the caller.
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map a pricing_seasons row to the admin/API shape.
 * @param {object} row
 * @returns {object}
 */
function mapSeason(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the start month field value.
    startMonth: Number(row.start_month),
    // Provide the start day field value.
    startDay: Number(row.start_day),
    // Provide the end month field value.
    endMonth: Number(row.end_month),
    // Provide the end day field value.
    endDay: Number(row.end_day),
    // Provide the adj type field value.
    adjType: row.adj_type,
    // Provide the adj value field value.
    adjValue: num(row.adj_value),
    // Provide the active field value.
    active: Boolean(row.active),
  };
}

/**
 * Map a pricing_weekend_rules row; default weekdays Fri–Sun when unset.
 * @param {object} row
 * @returns {object}
 */
function mapWeekend(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the weekdays field value.
    weekdays: Array.isArray(row.weekdays) ? row.weekdays.map(Number) : [5, 6, 0],
    // Provide the adj type field value.
    adjType: row.adj_type,
    // Provide the adj value field value.
    adjValue: num(row.adj_value),
    // Provide the active field value.
    active: Boolean(row.active),
  };
}

/**
 * Map a pricing_discount_rules row (duration / early-bird thresholds).
 * @param {object} row
 * @returns {object}
 */
function mapDiscount(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the kind field value.
    kind: row.kind,
    // Provide the name field value.
    name: row.name,
    // Provide the threshold field value.
    threshold: Number(row.threshold),
    // Provide the adj type field value.
    adjType: row.adj_type,
    // Provide the adj value field value.
    adjValue: num(row.adj_value),
    // Provide the active field value.
    active: Boolean(row.active),
  };
}

/**
 * Map a pricing_deposit_rules row.
 * @param {object} row
 * @returns {object}
 */
function mapDeposit(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the default amount field value.
    defaultAmount: num(row.default_amount),
    // Provide the active field value.
    active: Boolean(row.active),
  };
}

/**
 * Map a pricing_extras row (add-ons selectable at checkout).
 * @param {object} row
 * @returns {object}
 */
function mapExtra(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the code field value.
    code: row.code,
    // Provide the label field value.
    label: row.label,
    // Provide the mode field value.
    mode: row.mode,
    // Provide the amount field value.
    amount: num(row.amount),
    // Provide the active field value.
    active: Boolean(row.active),
    // Provide the sort order field value.
    sortOrder: Number(row.sort_order),
  };
}

/**
 * Map a pricing_global_fees row (hotel delivery, late return, etc.).
 * @param {object} row
 * @returns {object}
 */
function mapGlobalFee(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the fee key field value.
    feeKey: row.fee_key,
    // Provide the label field value.
    label: row.label,
    // Provide the amount field value.
    amount: num(row.amount),
    // Provide the mode field value.
    mode: row.mode,
    // Provide the active field value.
    active: Boolean(row.active),
  };
}

/**
 * Static delivery-fee list used when DB has no pricing_delivery_fees rows.
 * @returns {Array<{ locationId: string, fee: number }>}
 */
function fallbackDeliveryFees() {
  // Return the resulting value to the caller.
  return Object.entries(DELIVERY_FEES).map(([locationId, fee]) => ({
    // Contribute this line to the enclosing declaration or statement.
    locationId,
    // Provide the fee field value.
    fee: num(fee),
  }));
}

/**
 * Load the full pricing config from all pricing_* tables in parallel.
 * Empty delivery-fee table → static DELIVERY_FEES fallback.
 * @returns {Promise<object>} Aggregated seasons, rules, fees, extras, and maps
 */
async function loadPricingConfig() {
  // Parallel read of every pricing table; order is stable for admin UI.
  const [seasons, weekends, discounts, deposits, deliveryFees, globalFees, extras] =
    // Wait until the asynchronous operation resolves.
    await Promise.all([
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_seasons ORDER BY id ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_weekend_rules ORDER BY id ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_discount_rules ORDER BY kind ASC, id ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_deposit_rules ORDER BY id ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_delivery_fees ORDER BY location_id ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_global_fees ORDER BY fee_key ASC`),
      // Call pool.query to perform this step.
      pool.query(`SELECT * FROM pricing_extras ORDER BY sort_order ASC, id ASC`),
    ]);

  // Prefer DB delivery fees; fall back so checkout still prices locations.
  const delivery =
    // Continue the surrounding logic with this statement.
    deliveryFees.rows.length > 0
      // Continue the surrounding logic with this statement.
      ? deliveryFees.rows.map((r) => ({
          // Provide the location id field value.
          locationId: r.location_id,
          // Provide the fee field value.
          fee: num(r.fee),
        }))
      // Continue the surrounding logic with this statement.
      : fallbackDeliveryFees();

  // Create the delivery map constant.
  const deliveryMap = Object.fromEntries(delivery.map((d) => [d.locationId, d.fee]));

  // Return the resulting value to the caller.
  return {
    // Provide the seasons field value.
    seasons: seasons.rows.map(mapSeason),
    // Provide the weekend rules field value.
    weekendRules: weekends.rows.map(mapWeekend),
    // Provide the discount rules field value.
    discountRules: discounts.rows.map(mapDiscount),
    // Provide the deposit rules field value.
    depositRules: deposits.rows.map(mapDeposit),
    // Provide the delivery fees field value.
    deliveryFees: delivery,
    // Provide the delivery fee map field value.
    deliveryFeeMap: deliveryMap,
    // Provide the global fees field value.
    globalFees: globalFees.rows.map(mapGlobalFee),
    // Provide the extras field value.
    extras: extras.rows.map(mapExtra),
  };
}

/**
 * In-memory defaults when DB is unavailable (health/bootstrap paths).
 * @returns {object}
 */
function buildDefaultConfig() {
  // Return the resulting value to the caller.
  return {
    // Provide the seasons field value.
    seasons: [],
    // Provide the weekend rules field value.
    weekendRules: [],
    // Provide the discount rules field value.
    discountRules: [],
    // Provide the deposit rules field value.
    depositRules: [{ id: 0, name: 'Default deposit', defaultAmount: 300, active: true }],
    // Provide the delivery fees field value.
    deliveryFees: fallbackDeliveryFees(),
    // Provide the delivery fee map field value.
    deliveryFeeMap: { ...DELIVERY_FEES },
    // Provide the global fees field value.
    globalFees: [
      // Contribute this line to the enclosing declaration or statement.
      { feeKey: 'hotel_delivery', label: 'Hotel delivery', amount: 35, mode: 'flat', active: true },
      // Contribute this line to the enclosing declaration or statement.
      { feeKey: 'late_return', label: 'Late return fee', amount: 50, mode: 'flat', active: true },
      // Contribute this line to the enclosing declaration or statement.
      { feeKey: 'fuel', label: 'Fuel fee', amount: 40, mode: 'flat', active: true },
    ],
    // Provide the extras field value.
    extras: [],
  };
}

/**
 * Insert or update a single location delivery fee.
 * @param {string} locationId
 * @param {number} fee
 * @returns {Promise<{ locationId: string, fee: number }>}
 */
async function upsertDeliveryFee(locationId, fee) {
  // ON CONFLICT keeps location_id unique and refreshes updated_at.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO pricing_delivery_fees (location_id, fee, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (location_id) DO UPDATE
      SET fee = EXCLUDED.fee, updated_at = NOW()
    RETURNING location_id, fee
    `,
    // Contribute this line to the enclosing declaration or statement.
    [locationId, fee]
  );
  // Return the resulting value to the caller.
  return { locationId: result.rows[0].location_id, fee: num(result.rows[0].fee) };
}

/**
 * Upsert many delivery fees sequentially (admin bulk save).
 * @param {Array<{ locationId: string, fee: number }>} fees
 * @returns {Promise<Array<{ locationId: string, fee: number }>>}
 */
async function upsertDeliveryFees(fees) {
  // Create the out constant.
  const out = [];
  // Iterate using the loop initializer, condition, and step.
  for (const item of fees) {
    // Call out.push to perform this step.
    out.push(await upsertDeliveryFee(item.locationId, item.fee));
  }
  // Return the resulting value to the caller.
  return out;
}

/**
 * Insert or update a global fee by fee_key.
 * @param {string} feeKey
 * @param {{ label: string, amount: number, mode?: string, active?: boolean }} fields
 * @returns {Promise<object>}
 */
async function upsertGlobalFee(feeKey, { label, amount, mode, active }) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [feeKey, label, amount, mode || 'flat', active !== false]
  );
  // Return the resulting value to the caller.
  return mapGlobalFee(result.rows[0]);
}

/**
 * Create a seasonal price adjustment window.
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createSeason(data) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO pricing_seasons (
      name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      data.name,
      // Contribute this line to the enclosing declaration or statement.
      data.startMonth,
      // Contribute this line to the enclosing declaration or statement.
      data.startDay,
      // Contribute this line to the enclosing declaration or statement.
      data.endMonth,
      // Contribute this line to the enclosing declaration or statement.
      data.endDay,
      // Contribute this line to the enclosing declaration or statement.
      data.adjType || 'percent',
      // Contribute this line to the enclosing declaration or statement.
      data.adjValue,
      // Continue the surrounding logic with this statement.
      data.active !== false,
    ]
  );
  // Return the resulting value to the caller.
  return mapSeason(result.rows[0]);
}

/**
 * Update a season by id; returns null if missing.
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function updateSeason(id, data) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      data.name,
      // Contribute this line to the enclosing declaration or statement.
      data.startMonth,
      // Contribute this line to the enclosing declaration or statement.
      data.startDay,
      // Contribute this line to the enclosing declaration or statement.
      data.endMonth,
      // Contribute this line to the enclosing declaration or statement.
      data.endDay,
      // Contribute this line to the enclosing declaration or statement.
      data.adjType || 'percent',
      // Contribute this line to the enclosing declaration or statement.
      data.adjValue,
      // Continue the surrounding logic with this statement.
      data.active !== false,
    ]
  );
  // Return the resulting value to the caller.
  return result.rows[0] ? mapSeason(result.rows[0]) : null;
}

/**
 * Delete a season by id.
 * @param {number|string} id
 * @returns {Promise<boolean>} true when a row was deleted
 */
async function deleteSeason(id) {
  // Create the result constant.
  const result = await pool.query(`DELETE FROM pricing_seasons WHERE id = $1 RETURNING id`, [id]);
  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

/**
 * Update weekend rule when id is set; otherwise insert a new rule.
 * @param {number|string|null|undefined} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function upsertWeekendRule(id, data) {
  // Update path when admin edits an existing weekend rule.
  if (id) {
    // Create the result constant.
    const result = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE pricing_weekend_rules SET
        name = $2, weekdays = $3, adj_type = $4, adj_value = $5, active = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        // Contribute this line to the enclosing declaration or statement.
        id,
        // Contribute this line to the enclosing declaration or statement.
        data.name || 'Weekend',
        // Contribute this line to the enclosing declaration or statement.
        data.weekdays || [5, 6, 0],
        // Contribute this line to the enclosing declaration or statement.
        data.adjType || 'percent',
        // Contribute this line to the enclosing declaration or statement.
        data.adjValue,
        // Continue the surrounding logic with this statement.
        data.active !== false,
      ]
    );
    // Return the resulting value to the caller.
    return result.rows[0] ? mapWeekend(result.rows[0]) : null;
  }

  // Insert path for first-time weekend rule creation.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO pricing_weekend_rules (name, weekdays, adj_type, adj_value, active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      data.name || 'Weekend',
      // Contribute this line to the enclosing declaration or statement.
      data.weekdays || [5, 6, 0],
      // Contribute this line to the enclosing declaration or statement.
      data.adjType || 'percent',
      // Contribute this line to the enclosing declaration or statement.
      data.adjValue,
      // Continue the surrounding logic with this statement.
      data.active !== false,
    ]
  );
  // Return the resulting value to the caller.
  return mapWeekend(result.rows[0]);
}

/**
 * Partial update of a discount rule (COALESCE leaves unspecified columns unchanged).
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function updateDiscountRule(id, data) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [id, data.name, data.threshold, data.adjType, data.adjValue, data.active]
  );
  // Return the resulting value to the caller.
  return result.rows[0] ? mapDiscount(result.rows[0]) : null;
}

/**
 * Update deposit rule when id is set; otherwise insert.
 * @param {number|string|null|undefined} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function upsertDepositRule(id, data) {
  // Evaluate the condition and enter the branch when it is true.
  if (id) {
    // Create the result constant.
    const result = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE pricing_deposit_rules SET
        name = $2, default_amount = $3, active = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      // Continue the surrounding logic with this statement.
      [id, data.name || 'Default deposit', data.defaultAmount, data.active !== false]
    );
    // Return the resulting value to the caller.
    return result.rows[0] ? mapDeposit(result.rows[0]) : null;
  }

  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO pricing_deposit_rules (name, default_amount, active)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [data.name || 'Default deposit', data.defaultAmount, data.active !== false]
  );
  // Return the resulting value to the caller.
  return mapDeposit(result.rows[0]);
}

/**
 * Create a checkout extra (child seat, GPS, etc.).
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createExtra(data) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO pricing_extras (code, label, mode, amount, active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      data.code,
      // Contribute this line to the enclosing declaration or statement.
      data.label,
      // Contribute this line to the enclosing declaration or statement.
      data.mode || 'flat',
      // Contribute this line to the enclosing declaration or statement.
      data.amount,
      // Continue the surrounding logic with this statement.
      data.active !== false,
      // Contribute this line to the enclosing declaration or statement.
      data.sortOrder ?? 0,
    ]
  );
  // Return the resulting value to the caller.
  return mapExtra(result.rows[0]);
}

/**
 * Partial update of an extra; returns null if id missing.
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function updateExtra(id, data) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [id, data.label, data.mode, data.amount, data.active, data.sortOrder]
  );
  // Return the resulting value to the caller.
  return result.rows[0] ? mapExtra(result.rows[0]) : null;
}

/**
 * Delete an extra by id.
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
async function deleteExtra(id) {
  // Create the result constant.
  const result = await pool.query(`DELETE FROM pricing_extras WHERE id = $1 RETURNING id`, [id]);
  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  loadPricingConfig,
  // Contribute this line to the enclosing declaration or statement.
  buildDefaultConfig,
  // Contribute this line to the enclosing declaration or statement.
  upsertDeliveryFee,
  // Contribute this line to the enclosing declaration or statement.
  upsertDeliveryFees,
  // Contribute this line to the enclosing declaration or statement.
  upsertGlobalFee,
  // Contribute this line to the enclosing declaration or statement.
  createSeason,
  // Contribute this line to the enclosing declaration or statement.
  updateSeason,
  // Contribute this line to the enclosing declaration or statement.
  deleteSeason,
  // Contribute this line to the enclosing declaration or statement.
  upsertWeekendRule,
  // Contribute this line to the enclosing declaration or statement.
  updateDiscountRule,
  // Contribute this line to the enclosing declaration or statement.
  upsertDepositRule,
  // Contribute this line to the enclosing declaration or statement.
  createExtra,
  // Contribute this line to the enclosing declaration or statement.
  updateExtra,
  // Contribute this line to the enclosing declaration or statement.
  deleteExtra,
};
