const { clientQuery } = require('../../../db/transaction');
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');

async function update(reservation, client = null) {
  const reservationId = Number(reservation.id);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw new Error('Invalid reservation id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservations
    SET
      car_id = $2,
      session_id = $3,
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
      hold_expires_at = $24,
      stripe_session_id = $25,
      stripe_payment_intent_id = $26,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      reservationId,
      normalizeCarId(
        reservation.carId?.id || reservation.carId
      ),
      reservation.sessionId,
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
      reservation.deposit != null ? reservation.deposit : null,
      reservation.priceSnapshot ? JSON.stringify(reservation.priceSnapshot) : null,
      reservation.selectedExtras != null
        ? JSON.stringify(reservation.selectedExtras)
        : null,
      reservation.hotelDelivery != null ? Boolean(reservation.hotelDelivery) : null,
      reservation.fullName || null,
      reservation.phoneNumber || null,
      reservation.email || null,
      reservation.address || null,
      reservation.hotelName || null,
      reservation.status,
      reservation.holdExpiresAt,
      reservation.stripeSessionId || null,
      reservation.stripePaymentIntentId || null,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

async function applyStatusChange({ reservationId, newStatus, patch = null }, client = null) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid reservation id');
  }

  const contact = patch?.contact || null;
  const pricing = patch?.pricing || null;
  const hasHoldExpiresAt =
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'holdExpiresAt');
  const hasStripeSessionId =
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'stripeSessionId');
  const hasStripePaymentIntentId =
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'stripePaymentIntentId');
  const hasPaidAmountCents =
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'paidAmountCents');
  const hasPaidCurrency =
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'paidCurrency');
  const paidAmountCentsValue = hasPaidAmountCents ? Number(patch.paidAmountCents) : null;
  const paidCurrencyValue =
    hasPaidCurrency && patch.paidCurrency != null
      ? String(patch.paidCurrency).toLowerCase()
      : null;

  const result = await clientQuery(
    client,
    `
    UPDATE reservations
    SET
      status = $2,
      hold_expires_at = CASE WHEN $3::boolean THEN $4 ELSE hold_expires_at END,
      stripe_session_id = CASE WHEN $5::boolean THEN $6 ELSE stripe_session_id END,
      stripe_payment_intent_id = CASE WHEN $7::boolean THEN $8 ELSE stripe_payment_intent_id END,
      paid_amount_cents = CASE
        WHEN $22::boolean AND paid_amount_cents IS NULL THEN $23
        ELSE paid_amount_cents
      END,
      paid_currency = CASE
        WHEN $24::boolean AND paid_currency IS NULL THEN $25
        ELSE paid_currency
      END,
      full_name = COALESCE($9, full_name),
      phone_number = COALESCE($10, phone_number),
      email = COALESCE($11, email),
      address = COALESCE($12, address),
      hotel_name = COALESCE($13, hotel_name),
      rental_days = COALESCE($14, rental_days),
      delivery_price = COALESCE($15, delivery_price),
      return_price = COALESCE($16, return_price),
      total_price = COALESCE($17, total_price),
      deposit = COALESCE($18, deposit),
      price_snapshot = COALESCE($19::jsonb, price_snapshot),
      selected_extras = COALESCE($20::jsonb, selected_extras),
      hotel_delivery = COALESCE($21, hotel_delivery),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      newStatus,
      hasHoldExpiresAt,
      hasHoldExpiresAt ? patch.holdExpiresAt : null,
      hasStripeSessionId,
      hasStripeSessionId ? patch.stripeSessionId : null,
      hasStripePaymentIntentId,
      hasStripePaymentIntentId ? patch.stripePaymentIntentId : null,
      contact?.fullName ?? null,
      contact?.phoneNumber ?? null,
      contact?.email ?? null,
      contact?.address ?? null,
      contact?.hotelName ?? null,
      pricing?.rentalDays ?? null,
      pricing?.deliveryPrice ?? null,
      pricing?.returnPrice ?? null,
      pricing?.totalPrice ?? null,
      pricing?.deposit ?? null,
      pricing?.snapshot ? JSON.stringify(pricing.snapshot) : null,
      pricing?.snapshot?.selectedExtras != null || pricing?.selectedExtras != null
        ? JSON.stringify(pricing.snapshot?.selectedExtras || pricing.selectedExtras)
        : null,
      pricing?.snapshot?.hotelDelivery != null || pricing?.hotelDelivery != null
        ? Boolean(pricing.snapshot?.hotelDelivery ?? pricing.hotelDelivery)
        : null,
      hasPaidAmountCents && Number.isFinite(paidAmountCentsValue) && paidAmountCentsValue > 0,
      hasPaidAmountCents && Number.isFinite(paidAmountCentsValue) && paidAmountCentsValue > 0
        ? paidAmountCentsValue
        : null,
      Boolean(paidCurrencyValue),
      paidCurrencyValue,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

/**
 * Reserve a Stripe Checkout attempt number under the checkout lock.
 * Reuses the current attempt when a prior create crashed before linking
 * (session id already cleared, attempt already bumped). forceIncrement
 * is for link-failure after the orphan session was expired.
 */
async function reserveCheckoutAttempt(
  reservationId,
  { forceIncrement = false, client = null } = {}
) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid reservation id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservations
    SET
      stripe_checkout_attempt = CASE
        WHEN $2::boolean THEN stripe_checkout_attempt + 1
        WHEN stripe_session_id IS NULL AND stripe_checkout_attempt > 0 THEN stripe_checkout_attempt
        ELSE stripe_checkout_attempt + 1
      END,
      stripe_session_id = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING stripe_checkout_attempt
    `,
    [id, Boolean(forceIncrement)]
  );

  if (!result.rowCount) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return Number(result.rows[0].stripe_checkout_attempt);
}

/**
 * Create a confirmed reservation for admin-created/restored orders (ops coverage).
 */
async function createConfirmedReservation(payload, client = null) {
  const normalizedCarId = normalizeCarId(payload.carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const contact = payload.contact || {};
  const pricing = payload.pricing || {};
  const sessionId = payload.sessionId || `admin-${Date.now()}-${normalizedCarId}`;
  const holdExpiresAt = payload.holdExpiresAt || new Date();

  const result = await clientQuery(
    client,
    `
    INSERT INTO reservations (
      car_id,
      session_id,
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
      status,
      hold_expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16,
      $17, $18, $19, $20, $21,
      'confirmed', $22
    )
    RETURNING *
    `,
    [
      normalizedCarId,
      sessionId,
      payload.startDate || payload.pickupDate,
      payload.pickupTime || null,
      payload.endDate || payload.returnDate,
      payload.returnTime || null,
      payload.pickupLocation,
      payload.returnLocation,
      pricing.rentalDays ?? payload.rentalDays,
      pricing.deliveryPrice ?? payload.deliveryPrice ?? 0,
      pricing.returnPrice ?? payload.returnPrice ?? 0,
      pricing.totalPrice ?? payload.totalPrice,
      pricing.deposit ?? payload.deposit ?? 0,
      (pricing.snapshot || payload.priceSnapshot)
        ? JSON.stringify(pricing.snapshot || payload.priceSnapshot)
        : null,
      JSON.stringify(
        pricing.snapshot?.selectedExtras ||
          pricing.selectedExtras ||
          payload.selectedExtras ||
          []
      ),
      Boolean(
        pricing.snapshot?.hotelDelivery ??
          pricing.hotelDelivery ??
          payload.hotelDelivery
      ),
      contact.fullName || payload.fullName || null,
      contact.phoneNumber || payload.phoneNumber || null,
      contact.email || payload.email || null,
      contact.address || payload.address || null,
      contact.hotelName || payload.hotelName || null,
      holdExpiresAt,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

module.exports = {
  update,
  applyStatusChange,
  reserveCheckoutAttempt,
  createConfirmedReservation,
};
