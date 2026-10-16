/**
 * Map raw cars SQL rows to camelCase domain objects for public/admin consumers.
 */
const { clientQuery } = require('../../../db/transaction');

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

/**
 * Normalize car id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeCarId(value) {
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * parse page.
 * @param {*} raw
 * @param {*} [{ min]
 * @param {*} [max]
 * @returns {*}
 */
function parsePage(raw, { min = 1, max = 999999 } = {}) {
  const n = parseInt(String(raw ?? ''), 10);
  const page = Number.isFinite(n) ? n : 1;
  return Math.min(max, Math.max(min, page));
}

/**
 * Transform helper: to number or undefined.
 * @param {*} value
 * @returns {*}
 */
function toNumberOrUndefined(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === null || value === undefined) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Transform helper: to date only.
 * @param {*} value
 * @returns {*}
 */
function toDateOnly(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapFleetFields).
 * @param {object} row
 * @returns {*}
 */
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
/**
 * Map a DB/API row into the domain shape used by callers (mapSqlCar).
 * @param {object} row
 * @param {*} [dates]
 * @returns {*}
 */
function mapSqlCar(row, dates = []) {
  // Guard: early-return or throw when required input is missing/invalid.
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
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Load car row by id.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
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

module.exports = {
  CAR_SELECT,
  normalizeCarId,
  parsePage,
  mapSqlCar,
  mapPublicCar,
  fetchCarRowById,
};
