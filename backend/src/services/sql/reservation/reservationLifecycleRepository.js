/**
 * Reservation create/update/status lifecycle SQL (confirmed, cancelled, etc.).
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');

/**
 * Update or upsert row; returns null when not found.
 * @param {object} reservation
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function update(reservation, client = null) {
  // Create the reservation id constant.
  const reservationId = Number(reservation.id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid reservation id');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Call normalizeCarId to perform this step.
      normalizeCarId(
        // Contribute this line to the enclosing declaration or statement.
        reservation.carId?.id || reservation.carId
      ),
      // Contribute this line to the enclosing declaration or statement.
      reservation.sessionId,
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
      // Continue the surrounding logic with this statement.
      reservation.deposit != null ? reservation.deposit : null,
      // Continue the surrounding logic with this statement.
      reservation.priceSnapshot ? JSON.stringify(reservation.priceSnapshot) : null,
      // Continue the surrounding logic with this statement.
      reservation.selectedExtras != null
        // Continue the surrounding logic with this statement.
        ? JSON.stringify(reservation.selectedExtras)
        // Contribute this line to the enclosing declaration or statement.
        : null,
      // Continue the surrounding logic with this statement.
      reservation.hotelDelivery != null ? Boolean(reservation.hotelDelivery) : null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.fullName || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.phoneNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.email || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.address || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.hotelName || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.status,
      // Contribute this line to the enclosing declaration or statement.
      reservation.holdExpiresAt,
      // Contribute this line to the enclosing declaration or statement.
      reservation.stripeSessionId || null,
      // Contribute this line to the enclosing declaration or statement.
      reservation.stripePaymentIntentId || null,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]);
}

/**
 * apply status change with domain side effects as documented by callers.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function applyStatusChange({ reservationId, newStatus, patch = null }, client = null) {
  // Create the id constant.
  const id = Number(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid reservation id');
  }

  // Create the contact constant.
  const contact = patch?.contact || null;
  // Create the pricing constant.
  const pricing = patch?.pricing || null;
  // Create the has hold expires at constant.
  const hasHoldExpiresAt =
    // Continue the surrounding logic with this statement.
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'holdExpiresAt');
  // Create the has stripe session id constant.
  const hasStripeSessionId =
    // Continue the surrounding logic with this statement.
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'stripeSessionId');
  // Create the has stripe payment intent id constant.
  const hasStripePaymentIntentId =
    // Continue the surrounding logic with this statement.
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'stripePaymentIntentId');
  // Create the has paid amount cents constant.
  const hasPaidAmountCents =
    // Continue the surrounding logic with this statement.
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'paidAmountCents');
  // Create the has paid currency constant.
  const hasPaidCurrency =
    // Continue the surrounding logic with this statement.
    patch != null && Object.prototype.hasOwnProperty.call(patch, 'paidCurrency');
  // Create the paid amount cents value constant.
  const paidAmountCentsValue = hasPaidAmountCents ? Number(patch.paidAmountCents) : null;
  // Create the paid currency value constant.
  const paidCurrencyValue =
    // Continue the surrounding logic with this statement.
    hasPaidCurrency && patch.paidCurrency != null
      // Continue the surrounding logic with this statement.
      ? String(patch.paidCurrency).toLowerCase()
      // Contribute this line to the enclosing declaration or statement.
      : null;

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Contribute this line to the enclosing declaration or statement.
      hasHoldExpiresAt,
      // Contribute this line to the enclosing declaration or statement.
      hasHoldExpiresAt ? patch.holdExpiresAt : null,
      // Contribute this line to the enclosing declaration or statement.
      hasStripeSessionId,
      // Contribute this line to the enclosing declaration or statement.
      hasStripeSessionId ? patch.stripeSessionId : null,
      // Contribute this line to the enclosing declaration or statement.
      hasStripePaymentIntentId,
      // Contribute this line to the enclosing declaration or statement.
      hasStripePaymentIntentId ? patch.stripePaymentIntentId : null,
      // Contribute this line to the enclosing declaration or statement.
      contact?.fullName ?? null,
      // Contribute this line to the enclosing declaration or statement.
      contact?.phoneNumber ?? null,
      // Contribute this line to the enclosing declaration or statement.
      contact?.email ?? null,
      // Contribute this line to the enclosing declaration or statement.
      contact?.address ?? null,
      // Contribute this line to the enclosing declaration or statement.
      contact?.hotelName ?? null,
      // Contribute this line to the enclosing declaration or statement.
      pricing?.rentalDays ?? null,
      // Contribute this line to the enclosing declaration or statement.
      pricing?.deliveryPrice ?? null,
      // Contribute this line to the enclosing declaration or statement.
      pricing?.returnPrice ?? null,
      // Contribute this line to the enclosing declaration or statement.
      pricing?.totalPrice ?? null,
      // Contribute this line to the enclosing declaration or statement.
      pricing?.deposit ?? null,
      // Continue the surrounding logic with this statement.
      pricing?.snapshot ? JSON.stringify(pricing.snapshot) : null,
      // Continue the surrounding logic with this statement.
      pricing?.snapshot?.selectedExtras != null || pricing?.selectedExtras != null
        // Continue the surrounding logic with this statement.
        ? JSON.stringify(pricing.snapshot?.selectedExtras || pricing.selectedExtras)
        // Contribute this line to the enclosing declaration or statement.
        : null,
      // Continue the surrounding logic with this statement.
      pricing?.snapshot?.hotelDelivery != null || pricing?.hotelDelivery != null
        // Continue the surrounding logic with this statement.
        ? Boolean(pricing.snapshot?.hotelDelivery ?? pricing.hotelDelivery)
        // Contribute this line to the enclosing declaration or statement.
        : null,
      // Continue the surrounding logic with this statement.
      hasPaidAmountCents && Number.isFinite(paidAmountCentsValue) && paidAmountCentsValue > 0,
      // Continue the surrounding logic with this statement.
      hasPaidAmountCents && Number.isFinite(paidAmountCentsValue) && paidAmountCentsValue > 0
        // Contribute this line to the enclosing declaration or statement.
        ? paidAmountCentsValue
        // Contribute this line to the enclosing declaration or statement.
        : null,
      // Call Boolean to perform this step.
      Boolean(paidCurrencyValue),
      // Contribute this line to the enclosing declaration or statement.
      paidCurrencyValue,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]);
}

/**
 * Reserve a Stripe Checkout attempt number under the checkout lock.
 * Reuses the current attempt when a prior create crashed before linking
 * (session id already cleared, attempt already bumped). forceIncrement
 * is for link-failure after the orphan session was expired.
 */
async function reserveCheckoutAttempt(
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Continue the surrounding logic with this statement.
  { forceIncrement = false, client = null } = {}
// Continue the surrounding logic with this statement.
) {
  // Create the id constant.
  const id = Number(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid reservation id');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [id, Boolean(forceIncrement)]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Return the resulting value to the caller.
  return Number(result.rows[0].stripe_checkout_attempt);
}

/**
 * Create a confirmed reservation for admin-created/restored orders (ops coverage).
 */
async function createConfirmedReservation(payload, client = null) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(payload.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the contact constant.
  const contact = payload.contact || {};
  // Create the pricing constant.
  const pricing = payload.pricing || {};
  // Create the session id constant.
  const sessionId = payload.sessionId || `admin-${Date.now()}-${normalizedCarId}`;
  // Create the hold expires at constant.
  const holdExpiresAt = payload.holdExpiresAt || new Date();

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      sessionId,
      // Contribute this line to the enclosing declaration or statement.
      payload.startDate || payload.pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.pickupTime || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.endDate || payload.returnDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.returnTime || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      payload.returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      pricing.rentalDays ?? payload.rentalDays,
      // Contribute this line to the enclosing declaration or statement.
      pricing.deliveryPrice ?? payload.deliveryPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      pricing.returnPrice ?? payload.returnPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      pricing.totalPrice ?? payload.totalPrice,
      // Contribute this line to the enclosing declaration or statement.
      pricing.deposit ?? payload.deposit ?? 0,
      // Continue the surrounding logic with this statement.
      (pricing.snapshot || payload.priceSnapshot)
        // Continue the surrounding logic with this statement.
        ? JSON.stringify(pricing.snapshot || payload.priceSnapshot)
        // Contribute this line to the enclosing declaration or statement.
        : null,
      // Call JSON.stringify to perform this step.
      JSON.stringify(
        // Contribute this line to the enclosing declaration or statement.
        pricing.snapshot?.selectedExtras ||
          // Contribute this line to the enclosing declaration or statement.
          pricing.selectedExtras ||
          // Contribute this line to the enclosing declaration or statement.
          payload.selectedExtras ||
          []
      ),
      // Call Boolean to perform this step.
      Boolean(
        // Contribute this line to the enclosing declaration or statement.
        pricing.snapshot?.hotelDelivery ??
          // Contribute this line to the enclosing declaration or statement.
          pricing.hotelDelivery ??
          // Contribute this line to the enclosing declaration or statement.
          payload.hotelDelivery
      ),
      // Contribute this line to the enclosing declaration or statement.
      contact.fullName || payload.fullName || null,
      // Contribute this line to the enclosing declaration or statement.
      contact.phoneNumber || payload.phoneNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      contact.email || payload.email || null,
      // Contribute this line to the enclosing declaration or statement.
      contact.address || payload.address || null,
      // Contribute this line to the enclosing declaration or statement.
      contact.hotelName || payload.hotelName || null,
      // Contribute this line to the enclosing declaration or statement.
      holdExpiresAt,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  update,
  // Contribute this line to the enclosing declaration or statement.
  applyStatusChange,
  // Contribute this line to the enclosing declaration or statement.
  reserveCheckoutAttempt,
  // Contribute this line to the enclosing declaration or statement.
  createConfirmedReservation,
};
