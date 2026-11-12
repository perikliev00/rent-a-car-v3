/**
 * Parameterized order list/find queries including soft-delete and search filters.
 */
const { clientQuery } = require('../../../db/transaction');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  ORDER_SELECT,
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  normalizeId,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlOrder,
  // Contribute this line to the enclosing declaration or statement.
  attachCarToOrder,
// Continue the surrounding logic with this statement.
} = require('./orderMapper');

/**
 * Find order by id via SQL; returns null when missing.
 * @param {string|number} orderId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderById(orderId, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(orderId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * Find order by id populated via SQL; returns null when missing.
 * @param {string|number} orderId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderByIdPopulated(orderId, client = null) {
  // Create the order constant.
  const order = await findOrderById(orderId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(order.carId);
  // Return the resulting value to the caller.
  return attachCarToOrder(order, car);
}

/**
 * Find order by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderByReservationId(reservationId, client = null) {
  // Create the normalized reservation id constant.
  const normalizedReservationId = normalizeId(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedReservationId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.reservation_id = $1
      AND o.is_deleted = FALSE
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedReservationId]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * Find order by stripe session id via SQL; returns null when missing.
 * @param {string|number} stripeSessionId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderByStripeSessionId(stripeSessionId, client = null) {
  // Stripe / payment-related branch.
  if (!stripeSessionId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.stripe_session_id = $1
      AND o.is_deleted = FALSE
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [stripeSessionId]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * List orders from SQL.
 * @param {*} [filters]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listOrders(filters = {}, client = null) {
  // Create the conditions constant.
  const conditions = [];
  // Create the params constant.
  const params = [];

  // Evaluate the condition and enter the branch when it is true.
  if (filters.isDeleted === true) {
    // Call conditions.push to perform this step.
    conditions.push('o.is_deleted = TRUE');
  // Continue the surrounding logic with this statement.
  } else if (filters.isDeleted !== 'all') {
    // Call conditions.push to perform this step.
    conditions.push('o.is_deleted = FALSE');
  }

  // Status / lifecycle guard before mutating domain state.
  if (filters.status && ALLOWED_STATUSES.includes(filters.status)) {
    // Call params.push to perform this step.
    params.push(filters.status);
    // Call conditions.push to perform this step.
    conditions.push(`o.status = $${params.length}`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (filters.search && String(filters.search).trim()) {
    // Call params.push to perform this step.
    params.push(`%${String(filters.search).trim()}%`);
    // Create the idx constant.
    const idx = params.length;
    // Call conditions.push to perform this step.
    conditions.push(
      // Continue the surrounding logic with this statement.
      `(o.full_name ILIKE $${idx} OR o.email ILIKE $${idx} OR o.phone_number ILIKE $${idx})`
    );
  }

  // Evaluate the condition and enter the branch when it is true.
  if (filters.rangeStart && filters.rangeEnd) {
    // Call params.push to perform this step.
    params.push(filters.rangeEnd, filters.rangeStart);
    // Call conditions.push to perform this step.
    conditions.push(`o.pickup_date < $${params.length - 1}`);
    // Call conditions.push to perform this step.
    conditions.push(`o.return_date > $${params.length}`);
  }

  // Create the where sql constant.
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Initialize the mutable order by variable.
  let orderBy = 'o.created_at DESC';

  // Evaluate the condition and enter the branch when it is true.
  if (filters.sortBy === 'returnDateDesc') {
    // Update orderBy with the right-hand side value.
    orderBy = 'o.return_date DESC';
  // Continue the surrounding logic with this statement.
  } else if (filters.sortBy === 'deletedAtDesc') {
    // Update orderBy with the right-hand side value.
    orderBy = 'o.deleted_at DESC NULLS LAST';
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    ${whereSql}
    ORDER BY ${orderBy}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return result.rows.map(mapSqlOrder);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  findOrderById,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByIdPopulated,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  findOrderByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  listOrders,
};
