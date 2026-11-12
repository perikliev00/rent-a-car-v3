/**
 * Map reservation SQL rows to camelCase domain objects.
 */
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');

// Create the active status sql constant.
const ACTIVE_STATUS_SQL = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(', ');

/**
 * Normalize car id before persistence or comparison.
 * @param {string|number} carId
 * @returns {*}
 */
function normalizeCarId(carId) {
  // Create the id constant.
  const id = Number(carId);
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
 * Map a DB/API row into the domain shape used by callers (mapSqlReservation).
 * @param {object} row
 * @returns {*}
 */
function mapSqlReservation(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the car id value constant.
  const carIdValue = row.car_id != null ? String(row.car_id) : undefined;
  // Create the has populated car constant.
  const hasPopulatedCar = row.car_name != null && row.car_id != null;

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the car id field value.
    carId: hasPopulatedCar
      // Continue the surrounding logic with this statement.
      ? { id: String(row.car_id), name: row.car_name }
      // Contribute this line to the enclosing declaration or statement.
      : carIdValue,
    // Provide the session id field value.
    sessionId: row.session_id,
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
    fullName: row.full_name || undefined,
    // Provide the phone number field value.
    phoneNumber: row.phone_number || undefined,
    // Provide the email field value.
    email: row.email || undefined,
    // Provide the address field value.
    address: row.address || undefined,
    // Provide the hotel name field value.
    hotelName: row.hotel_name || undefined,
    // Provide the flight number field value.
    flightNumber: row.flight_number || undefined,
    // Provide the special requests field value.
    specialRequests: row.special_requests || undefined,
    // Provide the user id field value.
    userId: row.user_id != null ? String(row.user_id) : undefined,
    // Provide the status field value.
    status: row.status,
    // Provide the hold expires at field value.
    holdExpiresAt: row.hold_expires_at,
    // Provide the stripe session id field value.
    stripeSessionId: row.stripe_session_id || undefined,
    // Provide the stripe payment intent id field value.
    stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
    // Provide the stripe checkout attempt field value.
    stripeCheckoutAttempt: Number(row.stripe_checkout_attempt) || 0,
    // Provide the paid amount cents field value.
    paidAmountCents:
      // Continue the surrounding logic with this statement.
      row.paid_amount_cents != null && Number.isFinite(Number(row.paid_amount_cents))
        // Continue the surrounding logic with this statement.
        ? Number(row.paid_amount_cents)
        // Contribute this line to the enclosing declaration or statement.
        : undefined,
    // Provide the paid currency field value.
    paidCurrency: row.paid_currency || undefined,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

// Create the reservation select constant.
const RESERVATION_SELECT = `
  r.id,
  r.car_id,
  r.session_id,
  r.pickup_date,
  r.pickup_time,
  r.return_date,
  r.return_time,
  r.pickup_location,
  r.return_location,
  r.rental_days,
  r.delivery_price,
  r.return_price,
  r.total_price,
  r.deposit,
  r.price_snapshot,
  r.selected_extras,
  r.hotel_delivery,
  r.full_name,
  r.phone_number,
  r.email,
  r.address,
  r.hotel_name,
  r.flight_number,
  r.special_requests,
  r.user_id,
  r.status,
  r.hold_expires_at,
  r.stripe_session_id,
  r.stripe_payment_intent_id,
  r.stripe_checkout_attempt,
  r.paid_amount_cents,
  r.paid_currency,
  r.created_at,
  r.updated_at
`;

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_STATUS_SQL,
  // Contribute this line to the enclosing declaration or statement.
  normalizeCarId,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlReservation,
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_SELECT,
};
