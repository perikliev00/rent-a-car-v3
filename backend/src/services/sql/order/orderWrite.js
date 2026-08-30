const { clientQuery } = require('../../../db/transaction');
const { normalizeId, mapSqlOrder } = require('./orderMapper');

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
  createOrderFromReservation,
  createAdminOrder,
  updateOrderFromDoc,
  permanentlyDeleteSoftDeletedOrders,
};
