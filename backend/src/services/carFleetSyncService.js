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
  // Contribute this line to the enclosing declaration or statement.
  { reservation, oldStatus, newStatus },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the car id constant.
  const carId = reservation?.carId?.id || reservation?.carId;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) return null;

  // Row lock so two status transitions cannot overwrite each other mid-sync.
  const car = await carSql.findCarStatusForUpdate(carId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) return null;

  // Create the current constant.
  const current = car.status;

  // Hard overrides: physical rental always forces rented / post-return cleaning.
  if (newStatus === 'picked_up' || newStatus === 'active_rental') {
    // Evaluate the condition and enter the branch when it is true.
    if (current !== 'rented') {
      // Return the resulting value to the caller.
      return carSql.updateCarStatus(carId, 'rented', client);
    }
    // Return the resulting value to the caller.
    return car;
  }

  // Status / lifecycle guard before mutating domain state.
  if (newStatus === 'returned') {
    // Evaluate the condition and enter the branch when it is true.
    if (current !== 'needs_cleaning') {
      // Return the resulting value to the caller.
      return carSql.updateCarStatus(carId, 'needs_cleaning', client);
    }
    // Return the resulting value to the caller.
    return car;
  }

  // Soft promote available → reserved; leave other statuses (e.g. maintenance) alone.
  if (newStatus === 'confirmed' || newStatus === 'car_prepared') {
    // Evaluate the condition and enter the branch when it is true.
    if (current === 'available' || current === 'reserved') {
      // Evaluate the condition and enter the branch when it is true.
      if (current !== 'reserved') {
        // Return the resulting value to the caller.
        return carSql.updateCarStatus(carId, 'reserved', client);
      }
    }
    // Return the resulting value to the caller.
    return car;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Update newStatus with the right-hand side value.
    newStatus === 'cancelled' ||
    // Update newStatus with the right-hand side value.
    newStatus === 'no_show' ||
    // Update newStatus with the right-hand side value.
    newStatus === 'expired' ||
    // Update newStatus with the right-hand side value.
    newStatus === 'completed'
  // Continue the surrounding logic with this statement.
  ) {
    // Only release reserved → available when no other active fleet reservations
    if (current === 'reserved') {
      // Create the active count constant.
      const activeCount = await carSql.countActiveFleetReservations(
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        reservation.id,
        // Reference the identifier used by the enclosing expression.
        client
      );
      // Evaluate the condition and enter the branch when it is true.
      if (activeCount === 0) {
        // Return the resulting value to the caller.
        return carSql.updateCarStatus(carId, 'available', client);
      }
    }
    // Do not auto-clear rented / needs_cleaning / admin-forced statuses
    return car;
  }

  // Return the resulting value to the caller.
  return car;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  syncCarStatusFromReservation,
};
