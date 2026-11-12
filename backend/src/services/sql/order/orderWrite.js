/**
 * Order insert/update/soft-delete and hard-purge of aged soft-deleted rows.
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { normalizeId, mapSqlOrder } = require('./orderMapper');

/**
 * Create an order row from a reservation (payment finalize / admin confirm paths).
 * @param {object} reservation
 * @param {number|string} carId
 * @param {object|null} [client]
 */
async function createOrderFromReservation(reservation, carId, client = null) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeId(carId);
  // Create the normalized reservation id constant.
  const normalizedReservationId = normalizeId(reservation.id);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId || !normalizedReservationId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car or reservation id for order creation');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      normalizedReservationId,
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      reservation.pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      reservation.pickupTime || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.returnDate,
      // Contribute this line to the enclosing declaration or statement.
      reservation.returnTime || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      reservation.returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      reservation.rentalDays,
      // Contribute this line to the enclosing declaration or statement.
      reservation.deliveryPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      reservation.returnPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      reservation.totalPrice,
      // Contribute this line to the enclosing declaration or statement.
      reservation.deposit ?? 0,
      // Continue the surrounding logic with this statement.
      reservation.priceSnapshot ? JSON.stringify(reservation.priceSnapshot) : null,
      // Call JSON.stringify to perform this step.
      JSON.stringify(reservation.selectedExtras || []),
      // Call Boolean to perform this step.
      Boolean(reservation.hotelDelivery),
      // Contribute this line to the enclosing declaration or statement.
      reservation.fullName || '',
      // Contribute this line to the enclosing declaration or statement.
      reservation.phoneNumber || '',
      // Contribute this line to the enclosing declaration or statement.
      reservation.email || '',
      // Contribute this line to the enclosing declaration or statement.
      reservation.address || '',
      // Contribute this line to the enclosing declaration or statement.
      reservation.hotelName || null,
      // Continue the surrounding logic with this statement.
      reservation.userId != null ? Number(reservation.userId) : null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.stripeSessionId || null,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]);
}

/**
 * Insert an admin walk-in order (may already include reservationId).
 * @param {object} orderPayload
 * @param {object|null} [client]
 */
async function createAdminOrder(orderPayload, client = null) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeId(orderPayload.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id for order creation');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Call normalizeId to perform this step.
      normalizeId(orderPayload.reservationId) || null,
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.pickupTime || null,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.returnDate,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.returnTime || null,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.rentalDays,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.deliveryPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.returnPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.totalPrice,
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.deposit ?? 0,
      // Continue the surrounding logic with this statement.
      orderPayload.priceSnapshot ? JSON.stringify(orderPayload.priceSnapshot) : null,
      // Call JSON.stringify to perform this step.
      JSON.stringify(orderPayload.selectedExtras || []),
      // Call Boolean to perform this step.
      Boolean(orderPayload.hotelDelivery),
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.fullName || '',
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.phoneNumber || '',
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.email || '',
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.address || '',
      // Contribute this line to the enclosing declaration or statement.
      orderPayload.hotelName || null,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]);
}

/**
 * Persist a mutated order document (including soft-delete flags).
 * @param {object} order
 * @param {object|null} [client]
 */
async function updateOrderFromDoc(order, client = null) {
  // Create the order id constant.
  const orderId = normalizeId(order.id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!orderId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid order id');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Call normalizeId to perform this step.
      normalizeId(order.carId?.id || order.carId),
      // Call normalizeId to perform this step.
      normalizeId(order.reservationId) || null,
      // Contribute this line to the enclosing declaration or statement.
      order.pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      order.pickupTime || null,
      // Contribute this line to the enclosing declaration or statement.
      order.returnDate,
      // Contribute this line to the enclosing declaration or statement.
      order.returnTime || null,
      // Contribute this line to the enclosing declaration or statement.
      order.pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      order.returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      order.rentalDays,
      // Contribute this line to the enclosing declaration or statement.
      order.deliveryPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      order.returnPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      order.totalPrice,
      // Continue the surrounding logic with this statement.
      order.deposit != null ? order.deposit : null,
      // Continue the surrounding logic with this statement.
      order.priceSnapshot ? JSON.stringify(order.priceSnapshot) : null,
      // Continue the surrounding logic with this statement.
      order.selectedExtras != null ? JSON.stringify(order.selectedExtras) : null,
      // Continue the surrounding logic with this statement.
      order.hotelDelivery != null ? Boolean(order.hotelDelivery) : null,
      // Contribute this line to the enclosing declaration or statement.
      order.fullName || '',
      // Contribute this line to the enclosing declaration or statement.
      order.phoneNumber || '',
      // Contribute this line to the enclosing declaration or statement.
      order.email || '',
      // Contribute this line to the enclosing declaration or statement.
      order.address || '',
      // Contribute this line to the enclosing declaration or statement.
      order.hotelName || null,
      // Contribute this line to the enclosing declaration or statement.
      order.status || 'active',
      // Contribute this line to the enclosing declaration or statement.
      order.expiredAt || null,
      // Call Boolean to perform this step.
      Boolean(order.isDeleted),
      // Contribute this line to the enclosing declaration or statement.
      order.deletedAt || null,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlOrder(result.rows[0]);
}

/**
 * Hard-delete soft-deleted orders older than retentionDays (recycle-bin empty).
 * @param {{retentionDays?: number}} [opts]
 * @param {object|null} [client]
 */
async function permanentlyDeleteSoftDeletedOrders(
  // Continue the surrounding logic with this statement.
  { retentionDays = 30 } = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the params constant.
  const params = [];
  // Initialize the mutable sql variable.
  let sql = `DELETE FROM orders WHERE is_deleted = TRUE`;

  // Evaluate the condition and enter the branch when it is true.
  if (Number.isFinite(retentionDays) && retentionDays > 0) {
    // Call params.push to perform this step.
    params.push(retentionDays);
    // Update sql with the right-hand side value.
    sql += ` AND deleted_at IS NOT NULL AND deleted_at < NOW() - ($1 || ' days')::interval`;
  }

  // Create the result constant.
  const result = await clientQuery(client, sql, params);
  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createOrderFromReservation,
  // Contribute this line to the enclosing declaration or statement.
  createAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  updateOrderFromDoc,
  // Contribute this line to the enclosing declaration or statement.
  permanentlyDeleteSoftDeletedOrders,
};
