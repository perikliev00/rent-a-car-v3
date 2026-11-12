/**
 * Create reservation holds with overlap checks; race-sensitive booking entry point.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  acquireCarAdvisoryLocks,
  // Contribute this line to the enclosing declaration or statement.
  acquireSessionAdvisoryLock,
  // Contribute this line to the enclosing declaration or statement.
  clientQuery,
  // Contribute this line to the enclosing declaration or statement.
  isActiveSessionHoldUniqueViolation,
  // Contribute this line to the enclosing declaration or statement.
  isReservationHoldOverlapViolation,
  // Contribute this line to the enclosing declaration or statement.
  isUniqueViolation,
  // Contribute this line to the enclosing declaration or statement.
  runWithTransaction,
// Continue the surrounding logic with this statement.
} = require('../../../db/transaction');
// Destructure object properties into local variables.
const { HOLD_WINDOW_MS } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  findActiveBySessionId,
  // Contribute this line to the enclosing declaration or statement.
  findOverlappingHold,
  // Contribute this line to the enclosing declaration or statement.
  findBookedDateOverlap,
  // Contribute this line to the enclosing declaration or statement.
  findOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('./reservationReadRepository');
// Destructure object properties into local variables.
const { emptyCreateResult, findSessionHoldRows } = require('./reservationHoldHelpers');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForCar,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForSession,
// Continue the surrounding logic with this statement.
} = require('./reservationHoldExpiry');

/**
 * Insert a pending_payment reservation hold row (caller supplies locks/client).
 * holdExpiresAt = now + HOLD_WINDOW_MS so abandoned checkouts free the slot.
 * @param {object} fields
 * @param {object|null} [client]
 */
async function createPendingReservation(
  {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    sessionId,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    pricing,
    // Update contact with the right-hand side value.
    contact = {},
    // Update userId with the right-hand side value.
    userId = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Destructure object properties into local variables.
  const {
    // Update fullName with the right-hand side value.
    fullName = '',
    // Update phoneNumber with the right-hand side value.
    phoneNumber = '',
    // Update email with the right-hand side value.
    email = '',
    // Update address with the right-hand side value.
    address = '',
    // Update hotelName with the right-hand side value.
    hotelName = '',
  // Continue the surrounding logic with this statement.
  } = contact;

  // Create the raw user id constant.
  const rawUserId = userId != null ? Number(userId) : Number(contact.userId);
  // Create the normalized user id constant.
  const normalizedUserId =
    // Call Number.isInteger to perform this step.
    Number.isInteger(rawUserId) && rawUserId > 0 ? rawUserId : null;

  // Create the hold expires at constant.
  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  // Create the snapshot json constant.
  const snapshotJson = pricing.snapshot ? JSON.stringify(pricing.snapshot) : null;
  // Create the extras json constant.
  const extrasJson = JSON.stringify(
    // Contribute this line to the enclosing declaration or statement.
    pricing.snapshot?.selectedExtras || pricing.selectedExtras || []
  );

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
      user_id,
      status,
      hold_expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16,
      $17, $18, $19, $20, $21, $22,
      'pending_payment', $23
    )
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      sessionId,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      pickupTime || null,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      returnTime || null,
      // Contribute this line to the enclosing declaration or statement.
      pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      pricing.rentalDays,
      // Contribute this line to the enclosing declaration or statement.
      pricing.deliveryPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      pricing.returnPrice ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      pricing.totalPrice,
      // Contribute this line to the enclosing declaration or statement.
      pricing.deposit ?? 0,
      // Contribute this line to the enclosing declaration or statement.
      snapshotJson,
      // Contribute this line to the enclosing declaration or statement.
      extrasJson,
      // Call Boolean to perform this step.
      Boolean(pricing.snapshot?.hotelDelivery || pricing.hotelDelivery),
      // Contribute this line to the enclosing declaration or statement.
      fullName || null,
      // Contribute this line to the enclosing declaration or statement.
      phoneNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      email || null,
      // Contribute this line to the enclosing declaration or statement.
      address || null,
      // Contribute this line to the enclosing declaration or statement.
      hotelName || null,
      // Contribute this line to the enclosing declaration or statement.
      normalizedUserId,
      // Contribute this line to the enclosing declaration or statement.
      holdExpiresAt,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]);
}

/**
 * Full hold create under car + session advisory locks: expire stales, check
 * open rentals / booked overlaps / other holds, then insert. Race survivors
 * that hit unique/exclusion constraints are mapped to empty/conflict results.
 * @param {object} params
 */
async function createPendingReservationWithAvailabilityCheck({
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  sessionId,
  // Contribute this line to the enclosing declaration or statement.
  startDate,
  // Contribute this line to the enclosing declaration or statement.
  endDate,
  // Contribute this line to the enclosing declaration or statement.
  pickupTime,
  // Contribute this line to the enclosing declaration or statement.
  returnTime,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Update contact with the right-hand side value.
  contact = {},
  // Update userId with the right-hand side value.
  userId = null,
  // Update now with the right-hand side value.
  now = new Date(),
  // Update excludeSessionId with the right-hand side value.
  excludeSessionId = null,
// Continue the surrounding logic with this statement.
}) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionId || typeof sessionId !== 'string') {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid session id');
  }

  // Return the resulting value to the caller.
  return runWithTransaction(async (client) => {
    // Wait until the asynchronous operation resolves.
    await acquireSessionAdvisoryLock(client, sessionId);

    // Create the session holds constant.
    const sessionHolds = await findSessionHoldRows(sessionId, client);
    // Wait until the asynchronous operation resolves.
    await acquireCarAdvisoryLocks(client, [
      // Call ...sessionHolds.map to perform this step.
      ...sessionHolds.map((row) => row.car_id),
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
    ]);
    // Wait until the asynchronous operation resolves.
    await expireStaleHoldsForSession(sessionId, now, client);

    // Create the existing active reservation constant.
    const existingActiveReservation = await findActiveBySessionId(sessionId, client);
    // Idempotency guard: return early when work was already applied.
    if (existingActiveReservation) {
      // Return the resulting value to the caller.
      return emptyCreateResult({ existingActiveReservation });
    }

    // Wait until the asynchronous operation resolves.
    await expireStaleHoldsForCar(normalizedCarId, now, client);

    // Create the hold criteria constant.
    const holdCriteria = {
      // Provide the car id field value.
      carId: normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      now,
      // Contribute this line to the enclosing declaration or statement.
      excludeSessionId,
    };

    // Create the overlapping reservation constant.
    const overlappingReservation = await findOverlappingHold(holdCriteria, client);
    // Concurrency / overlap guard (race-sensitive).
    if (overlappingReservation) {
      // Return the resulting value to the caller.
      return emptyCreateResult({ overlappingReservation });
    }

    // Create the open physical rental constant.
    const openPhysicalRental = await findOpenPhysicalRental(normalizedCarId, client);
    // Evaluate the condition and enter the branch when it is true.
    if (openPhysicalRental) {
      // Return the resulting value to the caller.
      return emptyCreateResult({ bookedOverlap: { id: String(normalizedCarId) } });
    }

    // Create the booked overlap constant.
    const bookedOverlap = await findBookedDateOverlap(
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Reference the identifier used by the enclosing expression.
      client
    );
    // Concurrency / overlap guard (race-sensitive).
    if (bookedOverlap) {
      // Return the resulting value to the caller.
      return emptyCreateResult({ bookedOverlap });
    }

    // Wait until the asynchronous operation resolves.
    await client.query('SAVEPOINT hold_insert');
    // Protected block: isolate failure modes.
    try {
      // Create the reservation constant.
      const reservation = await createPendingReservation(
        {
          // Provide the car id field value.
          carId: normalizedCarId,
          // Contribute this line to the enclosing declaration or statement.
          sessionId,
          // Contribute this line to the enclosing declaration or statement.
          startDate,
          // Contribute this line to the enclosing declaration or statement.
          endDate,
          // Contribute this line to the enclosing declaration or statement.
          pickupTime,
          // Contribute this line to the enclosing declaration or statement.
          returnTime,
          // Contribute this line to the enclosing declaration or statement.
          pickupLocation,
          // Contribute this line to the enclosing declaration or statement.
          returnLocation,
          // Contribute this line to the enclosing declaration or statement.
          pricing,
          // Contribute this line to the enclosing declaration or statement.
          contact,
          // Contribute this line to the enclosing declaration or statement.
          userId,
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
      // Wait until the asynchronous operation resolves.
      await client.query('RELEASE SAVEPOINT hold_insert');
      // Return the resulting value to the caller.
      return emptyCreateResult({ reservation });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK TO SAVEPOINT hold_insert');

      // Evaluate the condition and enter the branch when it is true.
      if (isActiveSessionHoldUniqueViolation(err) || isUniqueViolation(err)) {
        // Create the existing constant.
        const existing = await findActiveBySessionId(sessionId, client);
        // Evaluate the condition and enter the branch when it is true.
        if (existing) {
          // Return the resulting value to the caller.
          return emptyCreateResult({ existingActiveReservation: existing });
        }
      }

      // Evaluate the condition and enter the branch when it is true.
      if (isReservationHoldOverlapViolation(err) || isUniqueViolation(err)) {
        // Create the conflicting hold constant.
        const conflictingHold = await findOverlappingHold(holdCriteria, client);
        // Return the resulting value to the caller.
        return emptyCreateResult({
          // Provide the overlapping reservation field value.
          overlappingReservation: conflictingHold || { id: String(normalizedCarId) },
        });
      }

      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservationWithAvailabilityCheck,
};
