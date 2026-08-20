const {
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  clientQuery,
  isActiveSessionHoldUniqueViolation,
  isReservationHoldOverlapViolation,
  isUniqueViolation,
  runWithTransaction,
} = require('../../../db/transaction');
const {
  ACTIVE_RESERVATION_STATUSES,
  HOLD_WINDOW_MS,
} = require('../../../utils/reservationHelpers');
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');
const {
  findActiveBySessionId,
  findByIdForUpdate,
  findOverlappingHold,
  findBookedDateOverlap,
} = require('./reservationReadRepository');
const { insertStatusHistory } = require('../reservationStatusHistorySqlService');

function resolveReservationCarId(reservation) {
  return normalizeCarId(reservation?.carId?.id || reservation?.carId);
}

function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
}

async function findSessionHoldRows(sessionId, client) {
  if (!sessionId) {
    return [];
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, car_id, status, hold_expires_at
    FROM reservations
    WHERE session_id = $1
      AND status = ANY($2::text[])
    ORDER BY id
    `,
    [sessionId, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rows || [];
}

/** Marks expired holds for one car so they leave the partial exclusion constraint. */
async function expireStaleHoldsForCar(carId, now = new Date(), client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE car_id = $1
        AND status = ANY($3::text[])
        AND hold_expires_at <= $2
      ORDER BY id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'hold_expired'
    FROM updated
    RETURNING reservation_id
    `,
    [normalizedCarId, now, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rowCount || 0;
}

async function expireStaleHoldsForSession(sessionId, now = new Date(), client = null) {
  if (!sessionId) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE session_id = $1
        AND status = ANY($3::text[])
        AND hold_expires_at <= $2
      ORDER BY id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'hold_expired'
    FROM updated
    RETURNING reservation_id
    `,
    [sessionId, now, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rowCount || 0;
}

async function createPendingReservation(
  {
    carId,
    sessionId,
    startDate,
    endDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pricing,
    contact = {},
    userId = null,
  },
  client = null
) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const {
    fullName = '',
    phoneNumber = '',
    email = '',
    address = '',
    hotelName = '',
  } = contact;

  const rawUserId = userId != null ? Number(userId) : Number(contact.userId);
  const normalizedUserId =
    Number.isInteger(rawUserId) && rawUserId > 0 ? rawUserId : null;

  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  const snapshotJson = pricing.snapshot ? JSON.stringify(pricing.snapshot) : null;
  const extrasJson = JSON.stringify(
    pricing.snapshot?.selectedExtras || pricing.selectedExtras || []
  );

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
      normalizedCarId,
      sessionId,
      startDate,
      pickupTime || null,
      endDate,
      returnTime || null,
      pickupLocation,
      returnLocation,
      pricing.rentalDays,
      pricing.deliveryPrice ?? 0,
      pricing.returnPrice ?? 0,
      pricing.totalPrice,
      pricing.deposit ?? 0,
      snapshotJson,
      extrasJson,
      Boolean(pricing.snapshot?.hotelDelivery || pricing.hotelDelivery),
      fullName || null,
      phoneNumber || null,
      email || null,
      address || null,
      hotelName || null,
      normalizedUserId,
      holdExpiresAt,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

async function updateHoldForRehold(
  {
    reservationId,
    carId,
    startDate,
    endDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pricing,
    holdExpiresAt,
  },
  client
) {
  const normalizedCarId = normalizeCarId(carId);
  const id = Number(reservationId);
  if (!normalizedCarId || !Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid rehold update arguments');
  }

  const snapshotJson = pricing.snapshot ? JSON.stringify(pricing.snapshot) : null;
  const extrasJson = JSON.stringify(
    pricing.snapshot?.selectedExtras || pricing.selectedExtras || []
  );

  const result = await clientQuery(
    client,
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
      id,
      normalizedCarId,
      startDate,
      pickupTime || null,
      endDate,
      returnTime || null,
      pickupLocation,
      returnLocation,
      pricing.rentalDays,
      pricing.deliveryPrice ?? 0,
      pricing.returnPrice ?? 0,
      pricing.totalPrice,
      pricing.deposit ?? 0,
      snapshotJson,
      extrasJson,
      Boolean(pricing.snapshot?.hotelDelivery || pricing.hotelDelivery),
      holdExpiresAt,
    ]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

function emptyCreateResult(overrides = {}) {
  return {
    reservation: null,
    existingActiveReservation: null,
    overlappingReservation: null,
    bookedOverlap: null,
    ...overrides,
  };
}

async function createPendingReservationWithAvailabilityCheck({
  carId,
  sessionId,
  startDate,
  endDate,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  pricing,
  contact = {},
  userId = null,
  now = new Date(),
  excludeSessionId = null,
}) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session id');
  }

  return runWithTransaction(async (client) => {
    await acquireSessionAdvisoryLock(client, sessionId);

    const sessionHolds = await findSessionHoldRows(sessionId, client);
    await acquireCarAdvisoryLocks(client, [
      ...sessionHolds.map((row) => row.car_id),
      normalizedCarId,
    ]);
    await expireStaleHoldsForSession(sessionId, now, client);

    const existingActiveReservation = await findActiveBySessionId(sessionId, client);
    if (existingActiveReservation) {
      return emptyCreateResult({ existingActiveReservation });
    }

    await expireStaleHoldsForCar(normalizedCarId, now, client);

    const holdCriteria = {
      carId: normalizedCarId,
      startDate,
      endDate,
      now,
      excludeSessionId,
    };

    const overlappingReservation = await findOverlappingHold(holdCriteria, client);
    if (overlappingReservation) {
      return emptyCreateResult({ overlappingReservation });
    }

    const bookedOverlap = await findBookedDateOverlap(
      normalizedCarId,
      startDate,
      endDate,
      client
    );
    if (bookedOverlap) {
      return emptyCreateResult({ bookedOverlap });
    }

    await client.query('SAVEPOINT hold_insert');
    try {
      const reservation = await createPendingReservation(
        {
          carId: normalizedCarId,
          sessionId,
          startDate,
          endDate,
          pickupTime,
          returnTime,
          pickupLocation,
          returnLocation,
          pricing,
          contact,
          userId,
        },
        client
      );
      await client.query('RELEASE SAVEPOINT hold_insert');
      return emptyCreateResult({ reservation });
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT hold_insert');

      if (isActiveSessionHoldUniqueViolation(err) || isUniqueViolation(err)) {
        const existing = await findActiveBySessionId(sessionId, client);
        if (existing) {
          return emptyCreateResult({ existingActiveReservation: existing });
        }
      }

      if (isReservationHoldOverlapViolation(err) || isUniqueViolation(err)) {
        const conflictingHold = await findOverlappingHold(holdCriteria, client);
        return emptyCreateResult({
          overlappingReservation: conflictingHold || { id: String(normalizedCarId) },
        });
      }

      throw err;
    }
  });
}

async function reholdPendingReservationWithAvailabilityCheck({
  sessionId,
  carId,
  startDate,
  endDate,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  pricing,
  now = new Date(),
}) {
  const normalizedNewCarId = normalizeCarId(carId);
  if (!normalizedNewCarId) {
    throw new Error('Invalid car id');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session id');
  }

  return runWithTransaction(async (client) => {
    await acquireSessionAdvisoryLock(client, sessionId);

    const sessionHolds = await findSessionHoldRows(sessionId, client);
    const peeked = await findActiveBySessionId(sessionId, client);
    if (peeked?.status === 'processing_payment') {
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    const oldCarId = resolveReservationCarId(peeked);
    await acquireCarAdvisoryLocks(client, [
      ...sessionHolds.map((row) => row.car_id),
      oldCarId,
      normalizedNewCarId,
    ]);
    await expireStaleHoldsForSession(sessionId, now, client);

    if (!peeked) {
      return { ok: false, reason: 'not_found' };
    }
    if (peeked.status !== 'pending_payment') {
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    const locked = await findByIdForUpdate(peeked.id, client);
    if (!locked || locked.sessionId !== sessionId) {
      return { ok: false, reason: 'not_found' };
    }
    if (locked.status === 'processing_payment') {
      return { ok: false, reason: 'rehold_not_allowed' };
    }
    if (locked.status !== 'pending_payment') {
      return { ok: false, reason: 'rehold_not_allowed' };
    }

    const lockedCarId = resolveReservationCarId(locked);
    for (const involvedCarId of [lockedCarId, normalizedNewCarId]) {
      await expireStaleHoldsForCar(involvedCarId, now, client);
    }

    const holdCriteria = {
      carId: normalizedNewCarId,
      startDate,
      endDate,
      now,
      excludeReservationId: locked.id,
    };

    const overlappingReservation = await findOverlappingHold(holdCriteria, client);
    if (overlappingReservation) {
      return { ok: false, conflict: true, reason: 'hold_overlap' };
    }

    const bookedOverlap = await findBookedDateOverlap(
      normalizedNewCarId,
      startDate,
      endDate,
      client
    );
    if (bookedOverlap) {
      return { ok: false, conflict: true, reason: 'booked_overlap' };
    }

    const fromCarId = lockedCarId;
    const fromPickup = locked.pickupDate;
    const fromReturn = locked.returnDate;
    const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
    const historyMetadata = {
      fromCarId,
      toCarId: normalizedNewCarId,
      fromPickup: toIso(fromPickup),
      fromReturn: toIso(fromReturn),
      toPickup: toIso(startDate),
      toReturn: toIso(endDate),
    };

    await client.query('SAVEPOINT hold_rehold');
    try {
      const reservation = await updateHoldForRehold(
        {
          reservationId: locked.id,
          carId: normalizedNewCarId,
          startDate,
          endDate,
          pickupTime,
          returnTime,
          pickupLocation,
          returnLocation,
          pricing,
          holdExpiresAt,
        },
        client
      );

      if (!reservation) {
        await client.query('ROLLBACK TO SAVEPOINT hold_rehold');
        const current = await findByIdForUpdate(locked.id, client);
        if (current?.status === 'processing_payment') {
          return { ok: false, reason: 'rehold_not_allowed' };
        }
        return { ok: false, reason: 'not_found' };
      }

      await insertStatusHistory(
        {
          reservationId: reservation.id,
          oldStatus: 'pending_payment',
          newStatus: 'pending_payment',
          changedByUserId: null,
          changedBySystem: false,
          reason: 'customer_reheld',
          metadata: historyMetadata,
        },
        client
      );
      await client.query('RELEASE SAVEPOINT hold_rehold');

      return {
        ok: true,
        reservation,
        fromCarId,
        fromPickup,
        fromReturn,
        historyMetadata,
      };
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT hold_rehold');
      if (
        isReservationHoldOverlapViolation(err) ||
        isActiveSessionHoldUniqueViolation(err) ||
        isUniqueViolation(err)
      ) {
        return { ok: false, conflict: true, reason: 'create_conflict' };
      }
      throw err;
    }
  });
}

async function markReservationExpired(reservationId, now = new Date(), client = null) {
  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE id = $1
        AND status = 'processing_payment'
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'stripe_session_expired'
    FROM updated
    RETURNING reservation_id
    `,
    [reservationId, now]
  );

  return (result.rowCount || 0) > 0;
}

async function markAbandonedReservations(activeSessionIds, now = new Date(), client = null) {
  const params = [ACTIVE_RESERVATION_STATUSES, now];
  const abandonConditions = ['r.hold_expires_at <= $2', 'r.session_id IS NULL'];

  if (activeSessionIds.length) {
    params.push(activeSessionIds);
    abandonConditions.push(`r.session_id <> ALL($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT r.id, r.status AS old_status
      FROM reservations r
      WHERE r.status = ANY($1::text[])
        AND NOT (r.status = 'processing_payment' AND r.stripe_session_id IS NOT NULL)
        AND (${abandonConditions.join(' OR ')})
      ORDER BY r.id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'abandoned_hold'
    FROM updated
    RETURNING reservation_id
    `,
    params
  );

  const reservationIds = (result.rows || [])
    .map((row) => (row.reservation_id != null ? String(row.reservation_id) : null))
    .filter(Boolean);

  return { count: reservationIds.length || result.rowCount || 0, reservationIds };
}

module.exports = {
  expireStaleHoldsForCar,
  expireStaleHoldsForSession,
  createPendingReservation,
  createPendingReservationWithAvailabilityCheck,
  reholdPendingReservationWithAvailabilityCheck,
  updateHoldForRehold,
  markReservationExpired,
  markAbandonedReservations,
};
