/**
 * Shared fleet-status booking guard: cars in HARD_UNBOOKABLE_STATUSES
 * (in_maintenance, damaged, inactive) must not receive new holds, checkout sessions,
 * rehold targets or admin walk-in orders.
 */
const { HARD_UNBOOKABLE_STATUSES } = require('../constants/carEnums');
const { AppError } = require('./appError');
const { clientQuery } = require('../db/transaction');

const CAR_NOT_BOOKABLE_CODE = 'CAR_NOT_BOOKABLE';
const CAR_NOT_BOOKABLE_MESSAGE =
  'Selected car is currently unavailable for booking. Please choose a different car.';

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
function isHardUnbookableStatus(status) {
  return HARD_UNBOOKABLE_STATUSES.includes(status);
}

/**
 * Throw a 409 conflict when the fleet status is a hard booking stop.
 *
 * @param {string|null|undefined} status
 * @throws {AppError} CAR_NOT_BOOKABLE (409)
 */
function assertCarStatusBookable(status) {
  if (isHardUnbookableStatus(status)) {
    throw new AppError(CAR_NOT_BOOKABLE_CODE, 409, CAR_NOT_BOOKABLE_MESSAGE, {
      carStatus: status,
    });
  }
}

/**
 * Read the current committed fleet status (call after taking the car advisory lock).
 *
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<string|null>}
 */
async function loadCarStatus(carId, client = null) {
  const result = await clientQuery(client, 'SELECT status FROM cars WHERE id = $1', [carId]);
  return result.rows?.[0]?.status ?? null;
}

/**
 * Load the car's fleet status and throw when hard-unbookable.
 *
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<void>}
 * @throws {AppError} CAR_NOT_BOOKABLE (409)
 */
async function assertCarBookableById(carId, client = null) {
  assertCarStatusBookable(await loadCarStatus(carId, client));
}

module.exports = {
  CAR_NOT_BOOKABLE_CODE,
  CAR_NOT_BOOKABLE_MESSAGE,
  isHardUnbookableStatus,
  assertCarStatusBookable,
  loadCarStatus,
  assertCarBookableById,
};
