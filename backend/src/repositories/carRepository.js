/**
 * Car repository facade over `carSqlService`.
 * Controllers/services should depend on this module rather than SQL helpers directly.
 */

const carSql = require('../services/sql/carSqlService');

/**
 * Load a public-facing car by id (customer catalog shape).
 *
 * @param {number|string} id - Car primary key
 * @returns {Promise<object|null>} Public car row, or null when missing
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findById(id) {
  return carSql.getSqlPublicCarById(id);
}

/**
 * Load an admin-facing car by id (includes internal fleet fields).
 *
 * @param {number|string} id - Car primary key
 * @returns {Promise<object|null>} Admin car row, or null when missing
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findByIdForAdmin(id) {
  return carSql.getSqlAdminCarById(id);
}

/**
 * Paginate cars for admin list views.
 *
 * @param {object} [criteria={}] - Filter criteria forwarded to the SQL service
 * @param {object} [options={}] - Pagination options (page, limit, sort, …)
 * @returns {Promise<object>} Page result from `paginateSqlCars`
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function paginate(criteria = {}, options = {}) {
  return carSql.paginateSqlCars(criteria, options);
}

/**
 * List all cars (optional transactional client).
 *
 * @param {import('pg').PoolClient | null} [client=null] - Transaction client, or pool when null
 * @returns {Promise<object[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function listAll(client = null) {
  return carSql.listAllCars(client);
}

/**
 * List image URLs for every car (cleanup / storage jobs).
 *
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<string[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function listAllImageUrls(client = null) {
  return carSql.listAllCarImageUrls(client);
}

/**
 * List cars currently marked available for booking.
 *
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function listAvailable(client = null) {
  return carSql.listAvailableCars(client);
}

/**
 * List cars matching a filter object (category, status, seats, …).
 *
 * @param {object} [filter={}] - Filter fields understood by `listCarsByFilter`
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function listByFilter(filter = {}, client = null) {
  return carSql.listCarsByFilter(filter, client);
}

/**
 * Insert a new admin car row.
 *
 * @param {object} payload - Admin create payload
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object>} Created car
 * @throws {Error} Propagates SQL / validation errors from the SQL service
 */
async function create(payload, client = null) {
  return carSql.createAdminCar(payload, client);
}

/**
 * Update an existing admin car row.
 *
 * @param {number|string} id - Car primary key
 * @param {object} payload - Partial admin update payload
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>} Updated car, or null when missing
 * @throws {Error} Propagates SQL / validation errors from the SQL service
 */
async function update(id, payload, client = null) {
  return carSql.updateAdminCar(id, payload, client);
}

/**
 * Soft/hard delete a car by id (behavior defined in SQL service).
 *
 * @param {number|string} id - Car primary key
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<unknown>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function deleteById(id, client = null) {
  return carSql.deleteCarById(id, client);
}

/**
 * Parse a raw page query value into a normalized page number.
 *
 * @param {unknown} raw - Raw page from query string / body
 * @param {object} options - Defaults / bounds for page parsing
 * @returns {number}
 * @throws {never} Invalid input is coerced by the SQL helper (does not throw)
 */
function parsePage(raw, options) {
  return carSql.parsePage(raw, options);
}

module.exports = {
  findById,
  findByIdForAdmin,
  paginate,
  listAll,
  listAllImageUrls,
  listAvailable,
  listByFilter,
  create,
  update,
  deleteById,
  parsePage,
};
