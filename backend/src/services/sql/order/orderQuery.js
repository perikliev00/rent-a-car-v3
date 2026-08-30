const { clientQuery } = require('../../../db/transaction');
const carRepository = require('../../../repositories/carRepository');
const {
  ORDER_SELECT,
  ALLOWED_STATUSES,
  normalizeId,
  mapSqlOrder,
  attachCarToOrder,
} = require('./orderMapper');

async function findOrderById(orderId, client = null) {
  const normalizedId = normalizeId(orderId);
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

async function findOrderByIdPopulated(orderId, client = null) {
  const order = await findOrderById(orderId, client);
  if (!order) {
    return null;
  }

  const car = await carRepository.findByIdForAdmin(order.carId);
  return attachCarToOrder(order, car);
}

async function findOrderByReservationId(reservationId, client = null) {
  const normalizedReservationId = normalizeId(reservationId);
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

async function findOrderByStripeSessionId(stripeSessionId, client = null) {
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

async function listOrders(filters = {}, client = null) {
  const conditions = [];
  const params = [];

  if (filters.isDeleted === true) {
    conditions.push('o.is_deleted = TRUE');
  } else if (filters.isDeleted !== 'all') {
    conditions.push('o.is_deleted = FALSE');
  }

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
