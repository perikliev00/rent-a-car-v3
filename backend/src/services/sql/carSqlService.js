const pool = require('../../db/pool');
const { parseSofiaDate } = require('../../utils/timeZone');
const { clientQuery } = require('../../db/transaction');
const { fetchDateBlocksByCarIds } = require('./bookingSyncSqlService');
const { HARD_UNBOOKABLE_STATUSES } = require('../../constants/carEnums');

const DEFAULT_PER_PAGE = 3;

const CAR_SELECT = `
  c.id,
  c.name,
  c.image,
  c.transmission,
  c.price,
  c.price_per_day,
  c.price_tier_1_3,
  c.price_tier_7_31,
  c.price_tier_31_plus,
  c.seats,
  c.fuel_type,
  c.availability,
  c.status,
  c.registration_number,
  c.vin,
  c.mileage,
  c.fuel_level,
  c.current_location,
  c.insurance_expiry,
  c.technical_inspection_expiry,
  c.category_id,
  cat.name AS category_name,
  c.is_deleted,
  c.deleted_at,
  c.created_at,
  c.updated_at
`;

function normalizeCarId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}
function parsePage(raw, { min = 1, max = 999999 } = {}) {
  const n = parseInt(String(raw ?? ''), 10);
  const page = Number.isFinite(n) ? n : 1;
  return Math.min(max, Math.max(min, page));
}

function toNumberOrUndefined(value) {
  if (value === null || value === undefined) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toDateOnly(value) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

function mapFleetFields(row) {
  return {
    status: row.status || 'available',
    registrationNumber: row.registration_number || undefined,
    vin: row.vin || undefined,
    mileage: row.mileage != null ? Number(row.mileage) : undefined,
    fuelLevel: row.fuel_level || undefined,
    currentLocation: row.current_location || undefined,
    insuranceExpiry: toDateOnly(row.insurance_expiry),
    technicalInspectionExpiry: toDateOnly(row.technical_inspection_expiry),
  };
}

// Превръща PostgreSQL row към application object за views и services.
function mapSqlCar(row, dates = []) {
  if (!row) return null;

  return {
    id: String(row.id),

    name: row.name,
    image: row.image,
    transmission: row.transmission,

    price: toNumberOrUndefined(row.price),
    pricePerDay: toNumberOrUndefined(row.price_per_day),

    priceTier_1_3: toNumberOrUndefined(row.price_tier_1_3),
    priceTier_7_31: toNumberOrUndefined(row.price_tier_7_31),
    priceTier_31_plus: toNumberOrUndefined(row.price_tier_31_plus),

    seats: Number(row.seats),
    fuelType: row.fuel_type,
    availability: row.availability,

    ...mapFleetFields(row),

    category: row.category_name || '',
    categoryId:
      row.category_id != null && Number.isFinite(Number(row.category_id))
        ? Number(row.category_id)
        : undefined,

    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at || undefined,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    dates: Array.isArray(dates) ? dates : [],
  };
}

/** Public catalog DTO — omits fleet ops internals. */
function mapPublicCar(row, dates = []) {
  const car = mapSqlCar(row, dates);
  if (!car) return null;

  return {
    id: car.id,
    name: car.name,
    image: car.image,
    transmission: car.transmission,
    price: car.price,
    pricePerDay: car.pricePerDay,
    priceTier_1_3: car.priceTier_1_3,
    priceTier_7_31: car.priceTier_7_31,
    priceTier_31_plus: car.priceTier_31_plus,
    seats: car.seats,
    fuelType: car.fuelType,
    availability: car.availability,
    category: car.category,
    categoryId: car.categoryId,
    dates: car.dates,
  };
}

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

async function fetchCarRowById(carId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = $1
    LIMIT 1
    `,
    [carId]
  );

  return result.rows[0] || null;
}

async function createAdminCar(payload, client = null) {
  const status = payload.status || (payload.availability === false ? 'inactive' : 'available');
  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    INSERT INTO cars (
      name,
      image,
      transmission,
      price,
      price_tier_1_3,
      price_tier_7_31,
      price_tier_31_plus,
      seats,
      fuel_type,
      availability,
      status,
      registration_number,
      vin,
      mileage,
      fuel_level,
      current_location,
      insurance_expiry,
      technical_inspection_expiry,
      category_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id
    `,
    [
      payload.name,
      payload.image,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      availability,
      status,
      payload.registrationNumber || null,
      payload.vin || null,
      payload.mileage ?? null,
      payload.fuelLevel || null,
      payload.currentLocation || null,
      payload.insuranceExpiry || null,
      payload.technicalInspectionExpiry || null,
      payload.categoryId ?? null,
    ]
  );

  const row = await fetchCarRowById(result.rows[0].id, client);
  return mapSqlCar(row);
}

async function updateAdminCar(id, payload, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const status =
    payload.status ||
    (payload.availability === false ? 'inactive' : 'available');
  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      name = $2,
      transmission = $3,
      price = $4,
      price_tier_1_3 = $5,
      price_tier_7_31 = $6,
      price_tier_31_plus = $7,
      seats = $8,
      fuel_type = $9,
      availability = $10,
      image = COALESCE($11, image),
      category_id = $12,
      status = $13,
      registration_number = $14,
      vin = $15,
      mileage = $16,
      fuel_level = $17,
      current_location = $18,
      insurance_expiry = $19,
      technical_inspection_expiry = $20,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [
      carId,
      payload.name,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      availability,
      payload.image || null,
      payload.categoryId ?? null,
      status,
      payload.registrationNumber || null,
      payload.vin || null,
      payload.mileage ?? null,
      payload.fuelLevel || null,
      payload.currentLocation || null,
      payload.insuranceExpiry || null,
      payload.technicalInspectionExpiry || null,
    ]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = await fetchCarRowById(carId, client);
  return mapSqlCar(row);
}

async function updateCarStatus(id, status, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      status = $2,
      availability = $3,
      updated_at = NOW()
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id
    `,
    [carId, status, availability]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = await fetchCarRowById(carId, client);
  return mapSqlCar(row);
}

async function findCarStatusForUpdate(id, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, status, availability, is_deleted
    FROM cars
    WHERE id = $1
    FOR UPDATE
    `,
    [carId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    status: row.status,
    availability: row.availability,
    isDeleted: Boolean(row.is_deleted),
  };
}

async function countActiveFleetReservations(carId, excludeReservationId = null, client = null) {
  const id = normalizeCarId(carId);
  if (!id) return 0;

  const params = [id];
  let excludeClause = '';
  if (excludeReservationId != null) {
    params.push(Number(excludeReservationId));
    excludeClause = `AND id <> $${params.length}`;
  }

  const result = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE car_id = $1
      AND status IN ('confirmed', 'car_prepared', 'picked_up', 'active_rental')
      ${excludeClause}
    `,
    params
  );

  return result.rows[0]?.count ?? 0;
}

async function deleteCarById(id, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      is_deleted = TRUE,
      deleted_at = NOW(),
      availability = FALSE,
      status = 'inactive',
      updated_at = NOW()
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id
    `,
    [carId]
  );

  return result.rowCount > 0;
}

module.exports = {
  mapSqlCar,
  mapPublicCar,
  paginateSqlCars,
  getSqlPublicCarById,
  getSqlAdminCarById,
  listAllCars,
  listAllCarImageUrls,
  listAvailableCars,
  listCarsByFilter,
  createAdminCar,
  updateAdminCar,
  updateCarStatus,
  findCarStatusForUpdate,
  countActiveFleetReservations,
  deleteCarById,
  parsePage,
};