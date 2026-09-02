const pool = require('../../../db/pool');
const { parseSofiaDate } = require('../../../utils/timeZone');
const { clientQuery } = require('../../../db/transaction');
const { fetchDateBlocksByCarIds } = require('../bookingSyncSqlService');
const { HARD_UNBOOKABLE_STATUSES } = require('../../../constants/carEnums');
const { CAR_SELECT, mapPublicCar, mapSqlCar, parsePage } = require('./carMapper');

const DEFAULT_PER_PAGE = 3;

function resolveSearchDateRange(options = {}) {
  const {
    startDate,
    endDate,
    pickupDate,
    returnDate,
    pickupTime = '10:00',
    returnTime = '10:00',
  } = options;

  if (startDate instanceof Date && endDate instanceof Date) {
    return { startDate, endDate };
  }

  if (pickupDate && returnDate) {
    const start = parseSofiaDate(pickupDate, pickupTime);
    const end = parseSofiaDate(returnDate, returnTime);
    if (
      start &&
      end &&
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime())
    ) {
      return { startDate: start, endDate: end };
    }
  }

  return null;
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function getPriceExpression(rentalDays) {
  const rd = Math.max(1, Number(rentalDays) || 1);

  if (rd <= 3) {
    return 'COALESCE(c.price_tier_1_3, c.price)';
  }

  if (rd <= 31) {
    return 'COALESCE(c.price_tier_7_31, c.price)';
  }

  return 'COALESCE(c.price_tier_31_plus, c.price)';
}

function buildCarWhere(criteria = {}, rentalDays = 1, options = {}) {
  const params = [];
  const where = ['c.is_deleted = FALSE'];

  // Bookability for a date range is calendar/holds — not the dual-written
  // availability boolean (false whenever status !== 'available', e.g. reserved).
  if (options.onlyAvailable) {
    const statusParam = addParam(params, HARD_UNBOOKABLE_STATUSES);
    where.push(`c.status <> ALL(${statusParam}::text[])`);
  }

  const searchRange = resolveSearchDateRange(options);
  if (searchRange) {
    const startParam = addParam(params, searchRange.startDate);
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

  if (criteria.transmission) {
    where.push(`LOWER(c.transmission) = LOWER(${addParam(params, criteria.transmission)})`);
  }

  if (criteria.fuelType) {
    where.push(`LOWER(c.fuel_type) = LOWER(${addParam(params, criteria.fuelType)})`);
  }

  if (criteria.seatsMin !== undefined) {
    where.push(`c.seats >= ${addParam(params, criteria.seatsMin)}`);
  }

  if (criteria.seatsMax !== undefined) {
    where.push(`c.seats <= ${addParam(params, criteria.seatsMax)}`);
  }

  if (criteria.categoryId !== undefined) {
    where.push(`c.category_id = ${addParam(params, criteria.categoryId)}`);
  }

  if (criteria.priceMin !== undefined || criteria.priceMax !== undefined) {
    const priceExpr = getPriceExpression(rentalDays);

    if (criteria.priceMin !== undefined) {
      where.push(`${priceExpr} >= ${addParam(params, criteria.priceMin)}`);
    }

    if (criteria.priceMax !== undefined) {
      where.push(`${priceExpr} <= ${addParam(params, criteria.priceMax)}`);
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function paginateSqlCars(criteria = {}, options = {}) {
  const {
    page: requestedPage = 1,
    perPage = DEFAULT_PER_PAGE,
    rentalDays = 1,
    onlyAvailable = false,
    pickupTime = '10:00',
    returnTime = '10:00',
    pickupDate,
    returnDate,
    startDate,
    endDate,
  } = options;

  const currentPage = parsePage(requestedPage);
  const skip = (currentPage - 1) * perPage;

  const { whereSql, params } = buildCarWhere(criteria, rentalDays, {
    onlyAvailable,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    startDate,
    endDate,
  });

  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

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

  const countQuery = `
    SELECT COUNT(*)::int AS total_count
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql};
  `;

  const [carsResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, perPage, skip]),
    pool.query(countQuery, params),
  ]);

  const totalCount = countResult.rows[0]?.total_count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const carIds = carsResult.rows.map((row) => Number(row.id));
  const dateBlocksByCarId = await fetchDateBlocksByCarIds(carIds);

  return {
    cars: carsResult.rows.map((row) =>
      mapPublicCar(row, dateBlocksByCarId.get(Number(row.id)) || [])
    ),
    currentPage,
    totalPages,
    totalCount,
    perPage,
    skip,
  };
}

async function fetchSqlCarById(id, { includeDeleted = false, publicView = false } = {}) {
  const carId = Number(id);

  if (!Number.isInteger(carId) || carId <= 0) {
    return null;
  }

  const deletedClause = includeDeleted ? '' : ' AND c.is_deleted = FALSE';

  const result = await pool.query(
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = $1${deletedClause}
    LIMIT 1;
    `,
    [carId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const dateBlocksByCarId = await fetchDateBlocksByCarIds([Number(row.id)]);
  const dates = dateBlocksByCarId.get(Number(row.id)) || [];
  return publicView ? mapPublicCar(row, dates) : mapSqlCar(row, dates);
}

async function getSqlPublicCarById(id) {
  return fetchSqlCarById(id, { includeDeleted: false, publicView: true });
}

async function getSqlAdminCarById(id) {
  return fetchSqlCarById(id, { includeDeleted: true, publicView: false });
}

async function listAllCars(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.is_deleted = FALSE
    ORDER BY c.name ASC
    `
  );

  return result.rows.map((row) => mapSqlCar(row));
}

async function listAllCarImageUrls(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT image
    FROM cars
    WHERE is_deleted = FALSE
      AND image IS NOT NULL
      AND image <> ''
    `
  );

  return result.rows.map((row) => row.image);
}

async function listAvailableCars(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.is_deleted = FALSE
      AND c.status <> ALL($1::text[])
    ORDER BY c.name ASC
    `,
    [HARD_UNBOOKABLE_STATUSES]
  );

  return result.rows.map((row) => mapSqlCar(row));
}

async function listCarsByFilter({
  categoryId,
  fuelType,
  transmission,
  seatsMin,
  seatsMax,
  onlyAvailable = true,
  limit = 10,
} = {}, client = null) {
  const params = [];
  const where = ['c.is_deleted = FALSE'];

  if (onlyAvailable) {
    params.push(HARD_UNBOOKABLE_STATUSES);
    where.push(`c.status <> ALL($${params.length}::text[])`);
  }

  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    params.push(Number(categoryId));
    where.push(`c.category_id = $${params.length}`);
  }

  if (fuelType) {
    params.push(fuelType);
    where.push(`LOWER(c.fuel_type) = LOWER($${params.length})`);
  }

  if (transmission) {
    params.push(transmission);
    where.push(`LOWER(c.transmission) = LOWER($${params.length})`);
  }

  if (seatsMin !== undefined && seatsMin !== null && seatsMin !== '') {
    params.push(Number(seatsMin));
    where.push(`c.seats >= $${params.length}`);
  }

  if (seatsMax !== undefined && seatsMax !== null && seatsMax !== '') {
    params.push(Number(seatsMax));
    where.push(`c.seats <= $${params.length}`);
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map((row) => mapSqlCar(row));
}

module.exports = {
  paginateSqlCars,
  getSqlPublicCarById,
  getSqlAdminCarById,
  listAllCars,
  listAllCarImageUrls,
  listAvailableCars,
  listCarsByFilter,
};
