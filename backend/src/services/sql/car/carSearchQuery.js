/**
 * Build parameterized car search/list SQL for catalog and admin filters.
 */
const pool = require('../../../db/pool');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../utils/timeZone');
// Destructure object properties into local variables.
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { fetchDateBlocksByCarIds } = require('../bookingSyncSqlService');
// Destructure object properties into local variables.
const { HARD_UNBOOKABLE_STATUSES } = require('../../../constants/carEnums');
// Destructure object properties into local variables.
const { CAR_SELECT, mapPublicCar, mapSqlCar, parsePage } = require('./carMapper');

// Create the default per page constant.
const DEFAULT_PER_PAGE = 3;

/**
 * Resolve search date range from inputs / Stripe / DB.
 * @param {object} [options]
 * @returns {*}
 */
function resolveSearchDateRange(options = {}) {
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Update pickupTime with the right-hand side value.
    pickupTime = '10:00',
    // Update returnTime with the right-hand side value.
    returnTime = '10:00',
  // Continue the surrounding logic with this statement.
  } = options;

  // Evaluate the condition and enter the branch when it is true.
  if (startDate instanceof Date && endDate instanceof Date) {
    // Return the resulting value to the caller.
    return { startDate, endDate };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (pickupDate && returnDate) {
    // Create the start constant.
    const start = parseSofiaDate(pickupDate, pickupTime);
    // Create the end constant.
    const end = parseSofiaDate(returnDate, returnTime);
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Contribute this line to the enclosing declaration or statement.
      start &&
      // Contribute this line to the enclosing declaration or statement.
      end &&
      // Continue the surrounding logic with this statement.
      !Number.isNaN(start.getTime()) &&
      // Continue the surrounding logic with this statement.
      !Number.isNaN(end.getTime())
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return { startDate: start, endDate: end };
    }
  }

  // Return the resulting value to the caller.
  return null;
}

/**
 * add param.
 * @param {*} params
 * @param {*} value
 * @returns {*}
 */
function addParam(params, value) {
  // Call params.push to perform this step.
  params.push(value);
  // Return the resulting value to the caller.
  return `$${params.length}`;
}

/**
 * Load price expression.
 * @param {*} rentalDays
 * @returns {*}
 */
function getPriceExpression(rentalDays) {
  // Create the rd constant.
  const rd = Math.max(1, Number(rentalDays) || 1);

  // Evaluate the condition and enter the branch when it is true.
  if (rd <= 3) {
    // Return the resulting value to the caller.
    return 'COALESCE(c.price_tier_1_3, c.price)';
  }

  // Evaluate the condition and enter the branch when it is true.
  if (rd <= 31) {
    // Return the resulting value to the caller.
    return 'COALESCE(c.price_tier_7_31, c.price)';
  }

  // Return the resulting value to the caller.
  return 'COALESCE(c.price_tier_31_plus, c.price)';
}

/**
 * Transform helper: build car where.
 * @param {*} [criteria]
 * @param {*} [rentalDays]
 * @param {object} [options]
 * @returns {*}
 */
function buildCarWhere(criteria = {}, rentalDays = 1, options = {}) {
  // Create the params constant.
  const params = [];
  // Create the where constant.
  const where = ['c.is_deleted = FALSE'];

  // Bookability for a date range is calendar/holds — not the dual-written
  // availability boolean (false whenever status !== 'available', e.g. reserved).
  if (options.onlyAvailable) {
    // Create the status param constant.
    const statusParam = addParam(params, HARD_UNBOOKABLE_STATUSES);
    // Call where.push to perform this step.
    where.push(`c.status <> ALL(${statusParam}::text[])`);
  }

  // Create the search range constant.
  const searchRange = resolveSearchDateRange(options);
  // Evaluate the condition and enter the branch when it is true.
  if (searchRange) {
    // Create the start param constant.
    const startParam = addParam(params, searchRange.startDate);
    // Create the end param constant.
    const endParam = addParam(params, searchRange.endDate);
    where.push(`NOT EXISTS (
      SELECT 1
      FROM car_date_blocks b
      WHERE b.car_id = c.id
        AND b.start_date < ${endParam}
        AND b.end_date > ${startParam}
    )`);
    where.push(`NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.car_id = c.id
        AND r.status IN ('pending_payment', 'processing_payment')
        AND r.hold_expires_at > NOW()
        AND r.pickup_date < ${endParam}
        AND r.return_date > ${startParam}
    )`);
    where.push(`NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.car_id = c.id
        AND r.status IN ('picked_up', 'active_rental')
    )`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (criteria.transmission) {
    // Call where.push to perform this step.
    where.push(`LOWER(c.transmission) = LOWER(${addParam(params, criteria.transmission)})`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (criteria.fuelType) {
    // Call where.push to perform this step.
    where.push(`LOWER(c.fuel_type) = LOWER(${addParam(params, criteria.fuelType)})`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (criteria.seatsMin !== undefined) {
    // Call where.push to perform this step.
    where.push(`c.seats >= ${addParam(params, criteria.seatsMin)}`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (criteria.seatsMax !== undefined) {
    // Call where.push to perform this step.
    where.push(`c.seats <= ${addParam(params, criteria.seatsMax)}`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (criteria.categoryId !== undefined) {
    // Call where.push to perform this step.
    where.push(`c.category_id = ${addParam(params, criteria.categoryId)}`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (criteria.priceMin !== undefined || criteria.priceMax !== undefined) {
    // Create the price expr constant.
    const priceExpr = getPriceExpression(rentalDays);

    // Guard: early-return or throw when required input is missing/invalid.
    if (criteria.priceMin !== undefined) {
      // Call where.push to perform this step.
      where.push(`${priceExpr} >= ${addParam(params, criteria.priceMin)}`);
    }

    // Guard: early-return or throw when required input is missing/invalid.
    if (criteria.priceMax !== undefined) {
      // Call where.push to perform this step.
      where.push(`${priceExpr} <= ${addParam(params, criteria.priceMax)}`);
    }
  }

  // Return the resulting value to the caller.
  return {
    // Provide the where sql field value.
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    // Contribute this line to the enclosing declaration or statement.
    params,
  };
}

/**
 * paginate sql cars.
 * @param {*} [criteria]
 * @param {object} [options]
 * @returns {Promise<*>}
 */
async function paginateSqlCars(criteria = {}, options = {}) {
  // Destructure object properties into local variables.
  const {
    // Provide the page field value.
    page: requestedPage = 1,
    // Update perPage with the right-hand side value.
    perPage = DEFAULT_PER_PAGE,
    // Update rentalDays with the right-hand side value.
    rentalDays = 1,
    // Update onlyAvailable with the right-hand side value.
    onlyAvailable = false,
    // Update pickupTime with the right-hand side value.
    pickupTime = '10:00',
    // Update returnTime with the right-hand side value.
    returnTime = '10:00',
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
  // Continue the surrounding logic with this statement.
  } = options;

  // Create the current page constant.
  const currentPage = parsePage(requestedPage);
  // Create the skip constant.
  const skip = (currentPage - 1) * perPage;

  // Destructure object properties into local variables.
  const { whereSql, params } = buildCarWhere(criteria, rentalDays, {
    // Contribute this line to the enclosing declaration or statement.
    onlyAvailable,
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
  });

  // Create the limit param constant.
  const limitParam = `$${params.length + 1}`;
  // Create the offset param constant.
  const offsetParam = `$${params.length + 2}`;

  // Create the data query constant.
  const dataQuery = `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT ${limitParam}
    OFFSET ${offsetParam};
  `;

  // Create the count query constant.
  const countQuery = `
    SELECT COUNT(*)::int AS total_count
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql};
  `;

  // Destructure array values into local variables.
  const [carsResult, countResult] = await Promise.all([
    // Call pool.query to perform this step.
    pool.query(dataQuery, [...params, perPage, skip]),
    // Call pool.query to perform this step.
    pool.query(countQuery, params),
  ]);

  // Create the total count constant.
  const totalCount = countResult.rows[0]?.total_count || 0;
  // Create the total pages constant.
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  // Create the car ids constant.
  const carIds = carsResult.rows.map((row) => Number(row.id));
  // Create the date blocks by car id constant.
  const dateBlocksByCarId = await fetchDateBlocksByCarIds(carIds);

  // Return the resulting value to the caller.
  return {
    // Provide the cars field value.
    cars: carsResult.rows.map((row) =>
      // Call mapPublicCar to perform this step.
      mapPublicCar(row, dateBlocksByCarId.get(Number(row.id)) || [])
    ),
    // Contribute this line to the enclosing declaration or statement.
    currentPage,
    // Contribute this line to the enclosing declaration or statement.
    totalPages,
    // Contribute this line to the enclosing declaration or statement.
    totalCount,
    // Contribute this line to the enclosing declaration or statement.
    perPage,
    // Contribute this line to the enclosing declaration or statement.
    skip,
  };
}

/**
 * Load sql car by id.
 * @param {string|number} id
 * @param {*} [{ includeDeleted]
 * @param {*} [publicView]
 * @returns {Promise<*>}
 */
async function fetchSqlCarById(id, { includeDeleted = false, publicView = false } = {}) {
  // Create the car id constant.
  const carId = Number(id);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(carId) || carId <= 0) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the deleted clause constant.
  const deletedClause = includeDeleted ? '' : ' AND c.is_deleted = FALSE';

  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = $1${deletedClause}
    LIMIT 1;
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );

  // Create the row constant.
  const row = result.rows[0];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the date blocks by car id constant.
  const dateBlocksByCarId = await fetchDateBlocksByCarIds([Number(row.id)]);
  // Create the dates constant.
  const dates = dateBlocksByCarId.get(Number(row.id)) || [];
  // Return the resulting value to the caller.
  return publicView ? mapPublicCar(row, dates) : mapSqlCar(row, dates);
}

/**
 * Load sql public car by id.
 * @param {string|number} id
 * @returns {Promise<*>}
 */
async function getSqlPublicCarById(id) {
  // Return the resulting value to the caller.
  return fetchSqlCarById(id, { includeDeleted: false, publicView: true });
}

/**
 * Load sql admin car by id.
 * @param {string|number} id
 * @returns {Promise<*>}
 */
async function getSqlAdminCarById(id) {
  // Return the resulting value to the caller.
  return fetchSqlCarById(id, { includeDeleted: true, publicView: false });
}

/**
 * List all cars from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listAllCars(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.is_deleted = FALSE
    ORDER BY c.name ASC
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => mapSqlCar(row));
}

/**
 * List all car image urls from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listAllCarImageUrls(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT image
    FROM cars
    WHERE is_deleted = FALSE
      AND image IS NOT NULL
      AND image <> ''
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => row.image);
}

/**
 * List available cars from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listAvailableCars(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.is_deleted = FALSE
      AND c.status <> ALL($1::text[])
    ORDER BY c.name ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [HARD_UNBOOKABLE_STATUSES]
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => mapSqlCar(row));
}

/**
 * Lightweight filtered car list for admin widgets / related picks (not full search).
 * @param {object} [filters]
 * @param {object|null} [client]
 * @returns {Promise<object[]>}
 */
async function listCarsByFilter({
  // Contribute this line to the enclosing declaration or statement.
  categoryId,
  // Contribute this line to the enclosing declaration or statement.
  fuelType,
  // Contribute this line to the enclosing declaration or statement.
  transmission,
  // Contribute this line to the enclosing declaration or statement.
  seatsMin,
  // Contribute this line to the enclosing declaration or statement.
  seatsMax,
  // Update onlyAvailable with the right-hand side value.
  onlyAvailable = true,
  // Update limit with the right-hand side value.
  limit = 10,
// Continue the surrounding logic with this statement.
} = {}, client = null) {
  // Create the params constant.
  const params = [];
  // Create the where constant.
  const where = ['c.is_deleted = FALSE'];

  // Exclude hard-unbookable statuses when onlyAvailable is requested.
  if (onlyAvailable) {
    // Call params.push to perform this step.
    params.push(HARD_UNBOOKABLE_STATUSES);
    // Call where.push to perform this step.
    where.push(`c.status <> ALL($${params.length}::text[])`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    // Call params.push to perform this step.
    params.push(Number(categoryId));
    // Call where.push to perform this step.
    where.push(`c.category_id = $${params.length}`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (fuelType) {
    // Call params.push to perform this step.
    params.push(fuelType);
    // Call where.push to perform this step.
    where.push(`LOWER(c.fuel_type) = LOWER($${params.length})`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (transmission) {
    // Call params.push to perform this step.
    params.push(transmission);
    // Call where.push to perform this step.
    where.push(`LOWER(c.transmission) = LOWER($${params.length})`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (seatsMin !== undefined && seatsMin !== null && seatsMin !== '') {
    // Call params.push to perform this step.
    params.push(Number(seatsMin));
    // Call where.push to perform this step.
    where.push(`c.seats >= $${params.length}`);
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (seatsMax !== undefined && seatsMax !== null && seatsMax !== '') {
    // Call params.push to perform this step.
    params.push(Number(seatsMax));
    // Call where.push to perform this step.
    where.push(`c.seats <= $${params.length}`);
  }

  // Call params.push to perform this step.
  params.push(limit);
  // Create the where sql constant.
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT $${params.length}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => mapPublicCar(row));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  paginateSqlCars,
  // Contribute this line to the enclosing declaration or statement.
  getSqlPublicCarById,
  // Contribute this line to the enclosing declaration or statement.
  getSqlAdminCarById,
  // Contribute this line to the enclosing declaration or statement.
  listAllCars,
  // Contribute this line to the enclosing declaration or statement.
  listAllCarImageUrls,
  // Contribute this line to the enclosing declaration or statement.
  listAvailableCars,
  // Contribute this line to the enclosing declaration or statement.
  listCarsByFilter,
};
