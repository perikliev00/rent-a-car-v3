const carSql = require('./sql/carSqlService');

/**
 * Sync car fleet status from reservation lifecycle inside the same DB transaction.
 */
async function syncCarStatusFromReservation(
  { reservation, oldStatus, newStatus },
  client = null
) {
  const carId = reservation?.carId?.id || reservation?.carId;
  if (!carId) return null;

  const car = await carSql.findCarStatusForUpdate(carId, client);
  if (!car || car.isDeleted) return null;

  const current = car.status;

  // Hard overrides
  if (newStatus === 'picked_up' || newStatus === 'active_rental') {
    if (current !== 'rented') {
      return carSql.updateCarStatus(carId, 'rented', client);
    }
    return car;
  }

  if (newStatus === 'returned') {
    if (current !== 'needs_cleaning') {
      return carSql.updateCarStatus(carId, 'needs_cleaning', client);
    }
    return car;
  }

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
