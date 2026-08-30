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

module.exports = {
  ORDER_SELECT,
  ALLOWED_STATUSES,
  normalizeId,
  mapSqlOrder,
  attachCarToOrder,
};
