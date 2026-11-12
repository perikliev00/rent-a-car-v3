/**
 * Map raw cars SQL rows to camelCase domain objects for public/admin consumers.
 */
const { clientQuery } = require('../../../db/transaction');

// Create the car select constant.
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
  // Create the id constant.
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
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
  // Create the n constant.
  const n = parseInt(String(raw ?? ''), 10);
  // Create the page constant.
  const page = Number.isFinite(n) ? n : 1;
  // Return the resulting value to the caller.
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

  // Create the number constant.
  const number = Number(value);
  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) {
    // Return the resulting value to the caller.
    return value.toISOString().slice(0, 10);
  }
  // Create the str constant.
  const str = String(value);
  // Return the resulting value to the caller.
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapFleetFields).
 * @param {object} row
 * @returns {*}
 */
function mapFleetFields(row) {
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: row.status || 'available',
    // Provide the registration number field value.
    registrationNumber: row.registration_number || undefined,
    // Provide the vin field value.
    vin: row.vin || undefined,
    // Provide the mileage field value.
    mileage: row.mileage != null ? Number(row.mileage) : undefined,
    // Provide the fuel level field value.
    fuelLevel: row.fuel_level || undefined,
    // Provide the current location field value.
    currentLocation: row.current_location || undefined,
    // Provide the insurance expiry field value.
    insuranceExpiry: toDateOnly(row.insurance_expiry),
    // Provide the technical inspection expiry field value.
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

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),

    // Provide the name field value.
    name: row.name,
    // Provide the image field value.
    image: row.image,
    // Provide the transmission field value.
    transmission: row.transmission,

    // Provide the price field value.
    price: toNumberOrUndefined(row.price),
    // Provide the price per day field value.
    pricePerDay: toNumberOrUndefined(row.price_per_day),

    // Provide the price tier 1 3 field value.
    priceTier_1_3: toNumberOrUndefined(row.price_tier_1_3),
    // Provide the price tier 7 31 field value.
    priceTier_7_31: toNumberOrUndefined(row.price_tier_7_31),
    // Provide the price tier 31 plus field value.
    priceTier_31_plus: toNumberOrUndefined(row.price_tier_31_plus),

    // Provide the seats field value.
    seats: Number(row.seats),
    // Provide the fuel type field value.
    fuelType: row.fuel_type,
    // Provide the availability field value.
    availability: row.availability,

    // Call ...mapFleetFields to perform this step.
    ...mapFleetFields(row),

    // Provide the category field value.
    category: row.category_name || '',
    // Provide the category id field value.
    categoryId:
      // Continue the surrounding logic with this statement.
      row.category_id != null && Number.isFinite(Number(row.category_id))
        // Continue the surrounding logic with this statement.
        ? Number(row.category_id)
        // Contribute this line to the enclosing declaration or statement.
        : undefined,

    // Provide the is deleted field value.
    isDeleted: Boolean(row.is_deleted),
    // Provide the deleted at field value.
    deletedAt: row.deleted_at || undefined,

    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,

    // Provide the dates field value.
    dates: Array.isArray(dates) ? dates : [],
  };
}

/**
 * Allowlist for anonymous catalog and chat responses.
 * @param {object|null|undefined} car
 * @returns {object|null}
 */
function pickPublicCarFields(car) {
  // Evaluate the condition and enter the branch when it is true.
  if (!car) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: car.id,
    // Provide the name field value.
    name: car.name,
    // Provide the image field value.
    image: car.image,
    // Provide the transmission field value.
    transmission: car.transmission,
    // Provide the price field value.
    price: car.price,
    // Provide the price per day field value.
    pricePerDay: car.pricePerDay,
    // Provide the price tier 1 3 field value.
    priceTier_1_3: car.priceTier_1_3,
    // Provide the price tier 7 31 field value.
    priceTier_7_31: car.priceTier_7_31,
    // Provide the price tier 31 plus field value.
    priceTier_31_plus: car.priceTier_31_plus,
    // Provide the seats field value.
    seats: car.seats,
    // Provide the fuel type field value.
    fuelType: car.fuelType,
    // Provide the availability field value.
    availability: car.availability,
    // Provide the category field value.
    category: car.category,
    // Provide the category id field value.
    categoryId: car.categoryId,
    // Provide the dates field value.
    dates: car.dates,
  };
}

/** Public catalog DTO — omits fleet ops internals. */
function mapPublicCar(row, dates = []) {
  // Return the resulting value to the caller.
  return pickPublicCarFields(mapSqlCar(row, dates));
}

/**
 * Load car row by id.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchCarRowById(carId, client = null) {
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
    WHERE c.id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );

  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CAR_SELECT,
  // Contribute this line to the enclosing declaration or statement.
  normalizeCarId,
  // Contribute this line to the enclosing declaration or statement.
  parsePage,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlCar,
  // Contribute this line to the enclosing declaration or statement.
  mapPublicCar,
  // Contribute this line to the enclosing declaration or statement.
  pickPublicCarFields,
  // Contribute this line to the enclosing declaration or statement.
  fetchCarRowById,
};
