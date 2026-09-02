const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');

const ACTIVE_STATUS_SQL = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(', ');

function normalizeCarId(carId) {
  const id = Number(carId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function toNumberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapSqlReservation(row) {
  if (!row) {
    return null;
  }

  const carIdValue = row.car_id != null ? String(row.car_id) : undefined;
  const hasPopulatedCar = row.car_name != null && row.car_id != null;

  return {
    id: String(row.id),
    carId: hasPopulatedCar
      ? { id: String(row.car_id), name: row.car_name }
      : carIdValue,
    sessionId: row.session_id,
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
    fullName: row.full_name || undefined,
    phoneNumber: row.phone_number || undefined,
    email: row.email || undefined,
    address: row.address || undefined,
    hotelName: row.hotel_name || undefined,
    flightNumber: row.flight_number || undefined,
    specialRequests: row.special_requests || undefined,
    userId: row.user_id != null ? String(row.user_id) : undefined,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    stripeSessionId: row.stripe_session_id || undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
    stripeCheckoutAttempt: Number(row.stripe_checkout_attempt) || 0,
    paidAmountCents:
      row.paid_amount_cents != null && Number.isFinite(Number(row.paid_amount_cents))
        ? Number(row.paid_amount_cents)
        : undefined,
    paidCurrency: row.paid_currency || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

module.exports = {
  ACTIVE_STATUS_SQL,
  normalizeCarId,
  mapSqlReservation,
  RESERVATION_SELECT,
};
