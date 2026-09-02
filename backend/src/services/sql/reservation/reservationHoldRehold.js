const {
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  clientQuery,
  isActiveSessionHoldUniqueViolation,
  isReservationHoldOverlapViolation,
  isUniqueViolation,
  runWithTransaction,
} = require('../../../db/transaction');
const { HOLD_WINDOW_MS } = require('../../../utils/reservationHelpers');
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');
const {
  findActiveBySessionId,
  findByIdForUpdate,
  findOverlappingHold,
  findBookedDateOverlap,
  findOpenPhysicalRental,
} = require('./reservationReadRepository');
const { insertStatusHistory } = require('../reservationStatusHistorySqlService');
const {
  findSessionHoldRows,
  resolveReservationCarId,
  toIso,
} = require('./reservationHoldHelpers');
const {
  expireStaleHoldsForCar,
  expireStaleHoldsForSession,
} = require('./reservationHoldExpiry');

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

    const openPhysicalRental = await findOpenPhysicalRental(normalizedNewCarId, client);
    if (openPhysicalRental) {
      return { ok: false, conflict: true, reason: 'booked_overlap' };
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

module.exports = {
  updateHoldForRehold,
  reholdPendingReservationWithAvailabilityCheck,
};
