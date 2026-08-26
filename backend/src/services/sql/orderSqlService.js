const { clientQuery } = require('../../db/transaction');
const { mapSqlCar } = require('./carSqlService');
const carRepository = require('../../repositories/carRepository');

const ORDER_SELECT = `
  o.id,
  o.reservation_id,
  o.car_id,
  o.pickup_date,
  o.pickup_time,
  o.return_date,
  o.return_time,
  o.pickup_location,
  o.return_location,
  o.rental_days,
  o.delivery_price,
  o.return_price,
  o.total_price,
  o.deposit,
  o.price_snapshot,
  o.selected_extras,
  o.hotel_delivery,
  o.full_name,
  o.phone_number,
  o.email,
  o.address,
  o.hotel_name,
  o.user_id,
  o.stripe_session_id,
  o.status,
  o.expired_at,
  o.is_deleted,
  o.deleted_at,
  o.created_at,
  o.updated_at
`;

const ALLOWED_STATUSES = ['active', 'pending', 'expired', 'cancelled'];

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function toNumberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapSqlOrder(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    reservationId: row.reservation_id != null ? String(row.reservation_id) : undefined,
    carId: row.car_id != null ? String(row.car_id) : undefined,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time || undefined,
    returnDate: row.return_date,
    returnTime: row.return_time || undefined,
    pickupLocation: row.pickup_location,
    returnLocation: row.return_location,
    rentalDays: Number(row.rental_days),
    deliveryPrice: toNumberOrZero(row.delivery_price),
    returnPrice: toNumberOrZero(row.return_price),
    totalPrice: toNumberOrZero(row.total_price),
    deposit: toNumberOrZero(row.deposit),
    priceSnapshot: row.price_snapshot || undefined,
    selectedExtras: Array.isArray(row.selected_extras) ? row.selected_extras : [],
    hotelDelivery: Boolean(row.hotel_delivery),
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    email: row.email,
    address: row.address,
    hotelName: row.hotel_name || undefined,
    userId: row.user_id != null ? String(row.user_id) : undefined,
    stripeSessionId: row.stripe_session_id || undefined,
    status: row.status,
    expiredAt: row.expired_at || undefined,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attachCarToOrder(order, car) {
  if (!order) {
    return null;
  }

  return {
    ...order,
    carId: car || order.carId,
  };
}

async function fetchCarsByIds(carIds, client = null) {
  const normalizedIds = [...new Set(
    carIds.map(normalizeId).filter((id) => id !== null)
  )];

  const map = new Map();
  if (!normalizedIds.length) {
    return map;
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      c.id,
      c.name,
      c.image,
      c.transmission,
      c.price,
      c.price_per_day,
      c.price_tier_1_3,
      c.price_tier_7_31,
      c.price_tier_31_plus,
      c.seats,
      c.fuel_type,
      c.availability,
      c.category_id,
      cat.name AS category_name,
      c.created_at,
      c.updated_at
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ANY($1::bigint[])
    `,
    [normalizedIds]
  );

  for (const row of result.rows) {
    map.set(Number(row.id), mapSqlCar(row));
  }

  return map;
}

async function populateOrdersWithCars(orders, client = null) {
  if (!Array.isArray(orders) || !orders.length) {
    return orders || [];
  }

  const carIds = orders.map((order) => order.carId);
  const carMap = await fetchCarsByIds(carIds, client);

  return orders.map((order) => {
    const carId = normalizeId(order.carId);
    return attachCarToOrder(order, carId ? carMap.get(carId) : undefined);
  });
}

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

/**
 * Locks the non-deleted order for a reservation, if one exists.
 * Taken after the reservation row on claim (see transaction.js lock order).
 */
async function lockByReservationIdForUpdate(reservationId, client) {
  const normalizedReservationId = normalizeId(reservationId);
  if (!normalizedReservationId || !client) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.reservation_id = $1
      AND o.is_deleted = FALSE
    FOR UPDATE
    `,
    [normalizedReservationId]
  );

  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * Claim-only: locks the linked order regardless of soft-delete.
 * Cancelled/refunded bookings soft-delete their order; claim must still see it
 * so ownership cannot diverge. Do not use for admin/public list filters.
 */
async function lockLinkedOrderForClaimByReservationId(reservationId, client) {
  const normalizedReservationId = normalizeId(reservationId);
  if (!normalizedReservationId || !client) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.reservation_id = $1
    ORDER BY o.id DESC
    LIMIT 1
    FOR UPDATE
    `,
    [normalizedReservationId]
  );

  return mapSqlOrder(result.rows[0]) || null;
}

/**
 * Locks a single order row by id (including soft-deleted). Used when locking
 * reservation first, then the known linked order (admin update lock order).
 */
async function lockOrderByIdForUpdate(orderId, client) {
  const id = normalizeId(orderId);
  if (!id || !client) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${ORDER_SELECT}
    FROM orders o
    WHERE o.id = $1
    FOR UPDATE
    `,
    [id]
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

async function createOrderFromReservation(reservation, carId, client = null) {
  const normalizedCarId = normalizeId(carId);
  const normalizedReservationId = normalizeId(reservation.id);

  if (!normalizedCarId || !normalizedReservationId) {
    throw new Error('Invalid car or reservation id for order creation');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO orders (
      reservation_id,
      car_id,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      pickup_location,
      return_location,
      rental_days,
      delivery_price,
      return_price,
      total_price,
      deposit,
      price_snapshot,
      selected_extras,
      hotel_delivery,
      full_name,
      phone_number,
      email,
      address,
      hotel_name,
      user_id,
      stripe_session_id,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16,
      $17, $18, $19, $20, $21, $22, $23,
      'active'
    )
    RETURNING *
    `,
    [
      normalizedReservationId,
      normalizedCarId,
      reservation.pickupDate,
      reservation.pickupTime || null,
      reservation.returnDate,
      reservation.returnTime || null,
      reservation.pickupLocation,
      reservation.returnLocation,
      reservation.rentalDays,
      reservation.deliveryPrice ?? 0,
      reservation.returnPrice ?? 0,
      reservation.totalPrice,
      reservation.deposit ?? 0,
      reservation.priceSnapshot ? JSON.stringify(reservation.priceSnapshot) : null,
      JSON.stringify(reservation.selectedExtras || []),
      Boolean(reservation.hotelDelivery),
      reservation.fullName || '',
      reservation.phoneNumber || '',
      reservation.email || '',
      reservation.address || '',
      reservation.hotelName || null,
      reservation.userId != null ? Number(reservation.userId) : null,
      reservation.stripeSessionId || null,
    ]
  );

  return mapSqlOrder(result.rows[0]);
}

async function createAdminOrder(orderPayload, client = null) {
  const normalizedCarId = normalizeId(orderPayload.carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id for order creation');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO orders (
      reservation_id,
      car_id,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      pickup_location,
      return_location,
      rental_days,
      delivery_price,
      return_price,
      total_price,
      deposit,
      price_snapshot,
      selected_extras,
      hotel_delivery,
      full_name,
      phone_number,
      email,
      address,
      hotel_name,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16,
      $17, $18, $19, $20, $21,
      'active'
    )
    RETURNING *
    `,
    [
      normalizeId(orderPayload.reservationId) || null,
      normalizedCarId,
      orderPayload.pickupDate,
      orderPayload.pickupTime || null,
      orderPayload.returnDate,
      orderPayload.returnTime || null,
      orderPayload.pickupLocation,
      orderPayload.returnLocation,
      orderPayload.rentalDays,
      orderPayload.deliveryPrice ?? 0,
      orderPayload.returnPrice ?? 0,
      orderPayload.totalPrice,
      orderPayload.deposit ?? 0,
      orderPayload.priceSnapshot ? JSON.stringify(orderPayload.priceSnapshot) : null,
      JSON.stringify(orderPayload.selectedExtras || []),
      Boolean(orderPayload.hotelDelivery),
      orderPayload.fullName || '',
      orderPayload.phoneNumber || '',
      orderPayload.email || '',
      orderPayload.address || '',
      orderPayload.hotelName || null,
    ]
  );

  return mapSqlOrder(result.rows[0]);
}

async function updateOrderFromDoc(order, client = null) {
  const orderId = normalizeId(order.id);
  if (!orderId) {
    throw new Error('Invalid order id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE orders
    SET
      car_id = $2,
      reservation_id = COALESCE($3, reservation_id),
      pickup_date = $4,
      pickup_time = $5,
      return_date = $6,
      return_time = $7,
      pickup_location = $8,
      return_location = $9,
      rental_days = $10,
      delivery_price = $11,
      return_price = $12,
      total_price = $13,
      deposit = COALESCE($14, deposit),
      price_snapshot = COALESCE($15::jsonb, price_snapshot),
      selected_extras = COALESCE($16::jsonb, selected_extras),
      hotel_delivery = COALESCE($17, hotel_delivery),
      full_name = $18,
      phone_number = $19,
      email = $20,
      address = $21,
      hotel_name = $22,
      status = $23,
      expired_at = $24,
      is_deleted = $25,
      deleted_at = $26,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      orderId,
      normalizeId(order.carId?.id || order.carId),
      normalizeId(order.reservationId) || null,
      order.pickupDate,
      order.pickupTime || null,
      order.returnDate,
      order.returnTime || null,
      order.pickupLocation,
      order.returnLocation,
      order.rentalDays,
      order.deliveryPrice ?? 0,
      order.returnPrice ?? 0,
      order.totalPrice,
      order.deposit != null ? order.deposit : null,
      order.priceSnapshot ? JSON.stringify(order.priceSnapshot) : null,
      order.selectedExtras != null ? JSON.stringify(order.selectedExtras) : null,
      order.hotelDelivery != null ? Boolean(order.hotelDelivery) : null,
      order.fullName || '',
      order.phoneNumber || '',
      order.email || '',
      order.address || '',
      order.hotelName || null,
      order.status || 'active',
      order.expiredAt || null,
      Boolean(order.isDeleted),
      order.deletedAt || null,
    ]
  );

  return mapSqlOrder(result.rows[0]);
}

/**
 * Links the order belonging to a reservation to a user, but only while it is still
 * unowned or already owned by that same user. Used by the explicit claim flow so the
 * reservation and its order change owner inside one transaction.
 */
async function assignOwnerByReservationIdIfUnclaimed(reservationId, userId, client) {
  const rid = Number(reservationId);
  const uid = Number(userId);
  if (!Number.isInteger(rid) || rid <= 0 || !Number.isInteger(uid) || uid <= 0) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE orders
    SET user_id = $2, updated_at = NOW()
    WHERE reservation_id = $1
      AND (user_id IS NULL OR user_id = $2)
    `,
    [rid, uid]
  );

  return result.rowCount || 0;
}

async function permanentlyDeleteSoftDeletedOrders(
  { retentionDays = 30 } = {},
  client = null
) {
  const params = [];
  let sql = `DELETE FROM orders WHERE is_deleted = TRUE`;

  if (Number.isFinite(retentionDays) && retentionDays > 0) {
    params.push(retentionDays);
    sql += ` AND deleted_at IS NOT NULL AND deleted_at < NOW() - ($1 || ' days')::interval`;
  }

  const result = await clientQuery(client, sql, params);
  return result.rowCount || 0;
}

module.exports = {
  ALLOWED_STATUSES,
  mapSqlOrder,
  attachCarToOrder,
  populateOrdersWithCars,
  findOrderById,
  findOrderByIdPopulated,
  findOrderByReservationId,
  lockByReservationIdForUpdate,
  lockLinkedOrderForClaimByReservationId,
  lockOrderByIdForUpdate,
  findOrderByStripeSessionId,
  listOrders,
  createOrderFromReservation,
  createAdminOrder,
  updateOrderFromDoc,
  assignOwnerByReservationIdIfUnclaimed,
  permanentlyDeleteSoftDeletedOrders,
};
