/**
 * Map orders SQL rows to camelCase order documents.
 */
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

// Create the allowed statuses constant.
const ALLOWED_STATUSES = ['active', 'pending', 'expired', 'cancelled'];

/**
 * Normalize id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeId(value) {
  // Create the id constant.
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return id;
}

/**
 * Transform helper: to number or zero.
 * @param {*} value
 * @returns {*}
 */
function toNumberOrZero(value) {
  // Create the number constant.
  const number = Number(value);
  // Return the resulting value to the caller.
  return Number.isFinite(number) ? number : 0;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapSqlOrder).
 * @param {object} row
 * @returns {*}
 */
function mapSqlOrder(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : undefined,
    // Provide the car id field value.
    carId: row.car_id != null ? String(row.car_id) : undefined,
    // Provide the pickup date field value.
    pickupDate: row.pickup_date,
    // Provide the pickup time field value.
    pickupTime: row.pickup_time || undefined,
    // Provide the return date field value.
    returnDate: row.return_date,
    // Provide the return time field value.
    returnTime: row.return_time || undefined,
    // Provide the pickup location field value.
    pickupLocation: row.pickup_location,
    // Provide the return location field value.
    returnLocation: row.return_location,
    // Provide the rental days field value.
    rentalDays: Number(row.rental_days),
    // Provide the delivery price field value.
    deliveryPrice: toNumberOrZero(row.delivery_price),
    // Provide the return price field value.
    returnPrice: toNumberOrZero(row.return_price),
    // Provide the total price field value.
    totalPrice: toNumberOrZero(row.total_price),
    // Provide the deposit field value.
    deposit: toNumberOrZero(row.deposit),
    // Provide the price snapshot field value.
    priceSnapshot: row.price_snapshot || undefined,
    // Provide the selected extras field value.
    selectedExtras: Array.isArray(row.selected_extras) ? row.selected_extras : [],
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(row.hotel_delivery),
    // Provide the full name field value.
    fullName: row.full_name,
    // Provide the phone number field value.
    phoneNumber: row.phone_number,
    // Provide the email field value.
    email: row.email,
    // Provide the address field value.
    address: row.address,
    // Provide the hotel name field value.
    hotelName: row.hotel_name || undefined,
    // Provide the user id field value.
    userId: row.user_id != null ? String(row.user_id) : undefined,
    // Provide the stripe session id field value.
    stripeSessionId: row.stripe_session_id || undefined,
    // Provide the status field value.
    status: row.status,
    // Provide the expired at field value.
    expiredAt: row.expired_at || undefined,
    // Provide the is deleted field value.
    isDeleted: row.is_deleted,
    // Provide the deleted at field value.
    deletedAt: row.deleted_at || undefined,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * attach car to order.
 * @param {object} order
 * @param {*} car
 * @returns {*}
 */
function attachCarToOrder(order, car) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!order) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Spread order into the surrounding structure.
    ...order,
    // Provide the car id field value.
    carId: car || order.carId,
  };
}

// Assign the CommonJS module exports.
module.exports = {
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
};
