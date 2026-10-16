/**
 * Parameterized order list/find queries including soft-delete and search filters.
 */
const { clientQuery } = require('../../../db/transaction');
const carRepository = require('../../../repositories/carRepository');
const {
  ORDER_SELECT,
  ALLOWED_STATUSES,
  normalizeId,
  mapSqlOrder,
  attachCarToOrder,
} = require('./orderMapper');

/**
 * Find order by id via SQL; returns null when missing.
 * @param {string|number} orderId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderById(orderId, client = null) {
  const normalizedId = normalizeId(orderId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.id = $1
    LIMIT 1
    `,
    [normalizedId]
  );

  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * Find order by id populated via SQL; returns null when missing.
 * @param {string|number} orderId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderByIdPopulated(orderId, client = null) {
  const order = await findOrderById(orderId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    return null;
  }

  const car = await carRepository.findByIdForAdmin(order.carId);
  return attachCarToOrder(order, car);
}

/**
 * Find order by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findOrderByReservationId(reservationId, client = null) {
  const normalizedReservationId = normalizeId(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedReservationId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.reservation_id = $1
      AND o.is_deleted = FALSE
    LIMIT 1
    `,
    [normalizedReservationId]
  );

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
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.stripe_session_id = $1
      AND o.is_deleted = FALSE
    LIMIT 1
    `,
    [stripeSessionId]
  );

  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * List orders from SQL.
 * @param {*} [filters]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listOrders(filters = {}, client = null) {
  const conditions = [];
  const params = [];

  if (filters.isDeleted === true) {
    conditions.push('o.is_deleted = TRUE');
  } else if (filters.isDeleted !== 'all') {
    conditions.push('o.is_deleted = FALSE');
  }

  // Status / lifecycle guard before mutating domain state.
  if (filters.status && ALLOWED_STATUSES.includes(filters.status)) {
    params.push(filters.status);
    conditions.push(`o.status = $${params.length}`);
  }

  if (filters.search && String(filters.search).trim()) {
    params.push(`%${String(filters.search).trim()}%`);
    const idx = params.length;
    conditions.push(
      `(o.full_name ILIKE $${idx} OR o.email ILIKE $${idx} OR o.phone_number ILIKE $${idx})`
    );
  }

  if (filters.rangeStart && filters.rangeEnd) {
    params.push(filters.rangeEnd, filters.rangeStart);
    conditions.push(`o.pickup_date < $${params.length - 1}`);
    conditions.push(`o.return_date > $${params.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  let orderBy = 'o.created_at DESC';

  if (filters.sortBy === 'returnDateDesc') {
    orderBy = 'o.return_date DESC';
  } else if (filters.sortBy === 'deletedAtDesc') {
    orderBy = 'o.deleted_at DESC NULLS LAST';
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    ${whereSql}
    ORDER BY ${orderBy}
    `,
    params
  );

  return result.rows.map(mapSqlOrder);
}

module.exports = {
  findOrderById,
  findOrderByIdPopulated,
  findOrderByReservationId,
  findOrderByStripeSessionId,
  listOrders,
};
