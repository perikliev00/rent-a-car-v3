/**
 * Extend/re-issue an existing hold (same session) without losing the slot.
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
  findByIdForUpdate,
  // Contribute this line to the enclosing declaration or statement.
  findOverlappingHold,
  // Contribute this line to the enclosing declaration or statement.
  findBookedDateOverlap,
  // Contribute this line to the enclosing declaration or statement.
  findOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('./reservationReadRepository');
// Destructure object properties into local variables.
const { insertStatusHistory } = require('../reservationStatusHistorySqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  findSessionHoldRows,
  // Contribute this line to the enclosing declaration or statement.
  resolveReservationCarId,
  // Contribute this line to the enclosing declaration or statement.
  toIso,
// Continue the surrounding logic with this statement.
} = require('./reservationHoldHelpers');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForCar,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForSession,
// Continue the surrounding logic with this statement.
} = require('./reservationHoldExpiry');

/**
 * Update a pending_payment hold's dates/pricing/car and refresh hold_expires_at.
 * Only touches rows still in pending_payment (rehold race guard).
 * @param {object} params
 * @param {object} client - Required open transaction client
 * @returns {Promise<object|null>}
 */
async function updateHoldForRehold(
  {
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Contribute this line to the enclosing declaration or statement.
    carId,
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
    holdExpiresAt,
  },
  // Reference the identifier used by the enclosing expression.
  client
// Continue the surrounding logic with this statement.
) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Create the id constant.
  const id = Number(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!normalizedCarId || !Number.isInteger(id) || id <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid rehold update arguments');
  }

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
    UPDATE reservations
    SET
      car_id = $2,
      pickup_date = $3,
      pickup_time = $4,
      return_date = $5,
      return_time = $6,
      pickup_location = $7,
      return_location = $8,
      rental_days = $9,
      delivery_price = $10,
      return_price = $11,
      total_price = $12,
      deposit = $13,
      price_snapshot = $14::jsonb,
      selected_extras = $15::jsonb,
      hotel_delivery = $16,
      hold_expires_at = $17,
      updated_at = NOW()
    WHERE id = $1
      AND status = 'pending_payment'
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      normalizedCarId,
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
      holdExpiresAt,
    ]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Rehold the session's pending reservation after availability checks and locks.
 * Expires stale holds, rejects overlaps, then updates the pending row in a transaction.
 * @param {object} params
 * @returns {Promise<object>} create/rehold result shape used by checkout
 */
async function reholdPendingReservationWithAvailabilityCheck({
  // Contribute this line to the enclosing declaration or statement.
  sessionId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
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
  // Update now with the right-hand side value.
  now = new Date(),
// Continue the surrounding logic with this statement.
}) {
  // Create the normalized new car id constant.
  const normalizedNewCarId = normalizeCarId(carId);
  // Evaluate the condition and enter the branch when it is true.
  if (!normalizedNewCarId) {
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
    // Create the peeked constant.
    const peeked = await findActiveBySessionId(sessionId, client);
    // Status / lifecycle guard before mutating domain state.
    if (peeked?.status === 'processing_payment') {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    // Create the old car id constant.
    const oldCarId = resolveReservationCarId(peeked);
    // Wait until the asynchronous operation resolves.
    await acquireCarAdvisoryLocks(client, [
      // Call ...sessionHolds.map to perform this step.
      ...sessionHolds.map((row) => row.car_id),
      // Contribute this line to the enclosing declaration or statement.
      oldCarId,
      // Contribute this line to the enclosing declaration or statement.
      normalizedNewCarId,
    ]);
    // Wait until the asynchronous operation resolves.
    await expireStaleHoldsForSession(sessionId, now, client);

    // Guard: early-return or throw when required input is missing/invalid.
    if (!peeked) {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'not_found' };
    }
    // Status / lifecycle guard before mutating domain state.
    if (peeked.status !== 'pending_payment') {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    // Create the locked constant.
    const locked = await findByIdForUpdate(peeked.id, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!locked || locked.sessionId !== sessionId) {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'not_found' };
    }
    // Status / lifecycle guard before mutating domain state.
    if (locked.status === 'processing_payment') {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'rehold_not_allowed' };
    }
    // Status / lifecycle guard before mutating domain state.
    if (locked.status !== 'pending_payment') {
      // Return the resulting value to the caller.
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    // Create the locked car id constant.
    const lockedCarId = resolveReservationCarId(locked);
    // Iterate using the loop initializer, condition, and step.
    for (const involvedCarId of [lockedCarId, normalizedNewCarId]) {
      // Wait until the asynchronous operation resolves.
      await expireStaleHoldsForCar(involvedCarId, now, client);
    }

    // Create the hold criteria constant.
    const holdCriteria = {
      // Provide the car id field value.
      carId: normalizedNewCarId,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      now,
      // Provide the exclude reservation id field value.
      excludeReservationId: locked.id,
    };

    // Create the overlapping reservation constant.
    const overlappingReservation = await findOverlappingHold(holdCriteria, client);
    // Concurrency / overlap guard (race-sensitive).
    if (overlappingReservation) {
      // Return the resulting value to the caller.
      return { ok: false, conflict: true, reason: 'hold_overlap' };
    }

    // Create the open physical rental constant.
    const openPhysicalRental = await findOpenPhysicalRental(normalizedNewCarId, client);
    // Evaluate the condition and enter the branch when it is true.
    if (openPhysicalRental) {
      // Return the resulting value to the caller.
      return { ok: false, conflict: true, reason: 'booked_overlap' };
    }

    // Create the booked overlap constant.
    const bookedOverlap = await findBookedDateOverlap(
      // Contribute this line to the enclosing declaration or statement.
      normalizedNewCarId,
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
      return { ok: false, conflict: true, reason: 'booked_overlap' };
    }

    // Create the from car id constant.
    const fromCarId = lockedCarId;
    // Create the from pickup constant.
    const fromPickup = locked.pickupDate;
    // Create the from return constant.
    const fromReturn = locked.returnDate;
    // Create the hold expires at constant.
    const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
    // Create the history metadata constant.
    const historyMetadata = {
      // Contribute this line to the enclosing declaration or statement.
      fromCarId,
      // Provide the to car id field value.
      toCarId: normalizedNewCarId,
      // Provide the from pickup field value.
      fromPickup: toIso(fromPickup),
      // Provide the from return field value.
      fromReturn: toIso(fromReturn),
      // Provide the to pickup field value.
      toPickup: toIso(startDate),
      // Provide the to return field value.
      toReturn: toIso(endDate),
    };

    // Wait until the asynchronous operation resolves.
    await client.query('SAVEPOINT hold_rehold');
    // Protected block: isolate failure modes.
    try {
      // Create the reservation constant.
      const reservation = await updateHoldForRehold(
        {
          // Provide the reservation id field value.
          reservationId: locked.id,
          // Provide the car id field value.
          carId: normalizedNewCarId,
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
          holdExpiresAt,
        },
        // Reference the identifier used by the enclosing expression.
        client
      );

      // Evaluate the condition and enter the branch when it is true.
      if (!reservation) {
        // Wait until the asynchronous operation resolves.
        await client.query('ROLLBACK TO SAVEPOINT hold_rehold');
        // Create the current constant.
        const current = await findByIdForUpdate(locked.id, client);
        // Evaluate the condition and enter the branch when it is true.
        if (current?.status === 'processing_payment') {
          // Return the resulting value to the caller.
          return { ok: false, reason: 'rehold_not_allowed' };
        }
        // Return the resulting value to the caller.
        return { ok: false, reason: 'not_found' };
      }

      // Wait until the asynchronous operation resolves.
      await insertStatusHistory(
        {
          // Provide the reservation id field value.
          reservationId: reservation.id,
          // Provide the old status field value.
          oldStatus: 'pending_payment',
          // Provide the new status field value.
          newStatus: 'pending_payment',
          // Provide the changed by user id field value.
          changedByUserId: null,
          // Provide the changed by system field value.
          changedBySystem: false,
          // Provide the reason field value.
          reason: 'customer_reheld',
          // Provide the metadata field value.
          metadata: historyMetadata,
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
      // Wait until the asynchronous operation resolves.
      await client.query('RELEASE SAVEPOINT hold_rehold');

      // Return the resulting value to the caller.
      return {
        // Provide the ok field value.
        ok: true,
        // Contribute this line to the enclosing declaration or statement.
        reservation,
        // Contribute this line to the enclosing declaration or statement.
        fromCarId,
        // Contribute this line to the enclosing declaration or statement.
        fromPickup,
        // Contribute this line to the enclosing declaration or statement.
        fromReturn,
        // Contribute this line to the enclosing declaration or statement.
        historyMetadata,
      };
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK TO SAVEPOINT hold_rehold');
      // Evaluate the condition and enter the branch when it is true.
      if (
        // Call isReservationHoldOverlapViolation to perform this step.
        isReservationHoldOverlapViolation(err) ||
        // Call isActiveSessionHoldUniqueViolation to perform this step.
        isActiveSessionHoldUniqueViolation(err) ||
        // Call isUniqueViolation to perform this step.
        isUniqueViolation(err)
      // Continue the surrounding logic with this statement.
      ) {
        // Return the resulting value to the caller.
        return { ok: false, conflict: true, reason: 'create_conflict' };
      }
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  updateHoldForRehold,
  // Contribute this line to the enclosing declaration or statement.
  reholdPendingReservationWithAvailabilityCheck,
};
