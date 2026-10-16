/**
 * Keeps car.fleet status aligned with reservation lifecycle transitions.
 * Intended to run inside the same DB transaction as the status change
 * (FOR UPDATE on the car row) so concurrent transitions cannot race.
 */
const carSql = require('./sql/carSqlService');

/**
 * Sync car fleet status from reservation lifecycle inside the same DB transaction.
 * @param {{reservation: object, oldStatus?: string, newStatus: string}} params
 * @param {object|null} [client]
 * @returns {Promise<object|null>} Updated/current car row, or null if skipped
 */
async function syncCarStatusFromReservation(
  { reservation, oldStatus, newStatus },
  client = null
) {
  const carId = reservation?.carId?.id || reservation?.carId;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) return null;

  // Row lock so two status transitions cannot overwrite each other mid-sync.
  const car = await carSql.findCarStatusForUpdate(carId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) return null;

  const current = car.status;

  // Hard overrides: physical rental always forces rented / post-return cleaning.
  if (newStatus === 'picked_up' || newStatus === 'active_rental') {
    if (current !== 'rented') {
      return carSql.updateCarStatus(carId, 'rented', client);
    }
    return car;
  }

  // Status / lifecycle guard before mutating domain state.
  if (newStatus === 'returned') {
    if (current !== 'needs_cleaning') {
      return carSql.updateCarStatus(carId, 'needs_cleaning', client);
    }
    return car;
  }

  // Soft promote available → reserved; leave other statuses (e.g. maintenance) alone.
  if (newStatus === 'confirmed' || newStatus === 'car_prepared') {
    if (current === 'available' || current === 'reserved') {
      if (current !== 'reserved') {
        return carSql.updateCarStatus(carId, 'reserved', client);
      }
    }
    return car;
  }

  if (
    newStatus === 'cancelled' ||
    newStatus === 'no_show' ||
    newStatus === 'expired' ||
    newStatus === 'completed'
  ) {
    // Only release reserved → available when no other active fleet reservations
    if (current === 'reserved') {
      const activeCount = await carSql.countActiveFleetReservations(
        carId,
        reservation.id,
        client
      );
      if (activeCount === 0) {
        return carSql.updateCarStatus(carId, 'available', client);
      }
    }
    // Do not auto-clear rented / needs_cleaning / admin-forced statuses
    return car;
  }

  return car;
}

module.exports = {
  syncCarStatusFromReservation,
};
