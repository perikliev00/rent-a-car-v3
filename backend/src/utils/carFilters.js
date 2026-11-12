/**
 * Shared car filter normalization for gallery (home) and search endpoints.
 * Parses raw query/body fields into typed criteria and applies post-pricing price filters.
 */

/**
 * Normalize a value to a trimmed lowercase string.
 *
 * @param {unknown} v
 * @returns {string}
 * @throws {never}
 */
function norm(v) {
  // Return the resulting value to the caller.
  return String(v ?? '').trim().toLowerCase();
}

/**
 * Parse a value as a finite number, or return undefined when empty/invalid.
 *
 * @param {unknown} v
 * @returns {number | undefined}
 * @throws {never}
 */
function toNumOrUndef(v) {
  // Evaluate the condition and enter the branch when it is true.
  if (v === undefined || v === null) return undefined;
  // Create the s constant.
  const s = String(v).trim();
  // Evaluate the condition and enter the branch when it is true.
  if (!s) return undefined;
  // Create the n constant.
  const n = Number(s);
  // Return the resulting value to the caller.
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Resolve category id from `categoryId` or legacy `category` query fields.
 *
 * @param {Record<string, unknown>} raw
 * @returns {number | undefined}
 * @throws {never}
 */
function parseCategoryId(raw) {
  // Prefer the modern categoryId field.
  const direct = toNumOrUndef(raw?.categoryId);
  // Evaluate the condition and enter the branch when it is true.
  if (direct !== undefined && direct >= 1) {
    // Return the resulting value to the caller.
    return direct;
  }

  // Legacy clients sent `category` as a numeric id.
  const legacyCategory = toNumOrUndef(raw?.category);
  // Evaluate the condition and enter the branch when it is true.
  if (legacyCategory !== undefined && legacyCategory >= 1) {
    // Return the resulting value to the caller.
    return legacyCategory;
  }

  // Return the resulting value to the caller.
  return undefined;
}

/**
 * Normalize raw filter fields (query or body) into effective car search criteria.
 *
 * @param {Record<string, unknown>} [raw={}]
 * @returns {{
 *   categoryId?: number,
 *   transmission: string,
 *   fuelType: string,
 *   seatsMin?: number,
 *   seatsMax?: number,
 *   priceMin?: number,
 *   priceMax?: number
 * }}
 * @throws {never}
 */
function parseCarFilterRaw(raw = {}) {
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    transmission,
    // Contribute this line to the enclosing declaration or statement.
    fuelType,
    // Contribute this line to the enclosing declaration or statement.
    seatsMin,
    // Contribute this line to the enclosing declaration or statement.
    seatsMax,
    // Contribute this line to the enclosing declaration or statement.
    priceMin,
    // Contribute this line to the enclosing declaration or statement.
    priceMax,
  // Continue the surrounding logic with this statement.
  } = raw;

  // Coerce strings to typed criteria; empty strings become '' / undefined as appropriate.
  return {
    // Provide the category id field value.
    categoryId: parseCategoryId(raw),
    // Provide the transmission field value.
    transmission: norm(transmission),
    // Provide the fuel type field value.
    fuelType: norm(fuelType),
    // Provide the seats min field value.
    seatsMin: toNumOrUndef(seatsMin),
    // Provide the seats max field value.
    seatsMax: toNumOrUndef(seatsMax),
    // Provide the price min field value.
    priceMin: toNumOrUndef(priceMin),
    // Provide the price max field value.
    priceMax: toNumOrUndef(priceMax),
  };
}

/**
 * Exact filter by daily/unit price after `computeBookingPrice`.
 *
 * @param {Array<Record<string, unknown>>} cars
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 * @returns {Array<Record<string, unknown>>}
 * @throws {never}
 */
function filterCarsByComputedUnitPrice(cars, criteria) {
  // No price bounds → return the list unchanged.
  if (criteria.priceMin === undefined && criteria.priceMax === undefined) {
    // Return the resulting value to the caller.
    return cars;
  }
  // Return the resulting value to the caller.
  return cars.filter((car) => {
    // Create the unit constant.
    const unit = Number(car.unitPrice ?? car.price);
    // Evaluate the condition and enter the branch when it is true.
    if (criteria.priceMin !== undefined && (!Number.isFinite(unit) || unit < criteria.priceMin)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Evaluate the condition and enter the branch when it is true.
    if (criteria.priceMax !== undefined && (!Number.isFinite(unit) || unit > criteria.priceMax)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Return the resulting value to the caller.
    return true;
  });
}

/**
 * String view-model values for API `filters` on gallery/search responses.
 *
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 * @param {Record<string, unknown>} [raw] - Original strings when numeric parse failed
 * @returns {Record<string, string>}
 * @throws {never}
 */
function filtersViewModel(criteria, raw = {}) {
  // Create the r constant.
  const r = raw || {};
  // Return the resulting value to the caller.
  return {
    // Provide the category id field value.
    categoryId: criteria.categoryId !== undefined ? String(criteria.categoryId) : '',
    // Provide the transmission field value.
    transmission: criteria.transmission || '',
    // Provide the fuel type field value.
    fuelType: criteria.fuelType || '',
    // Provide the price min field value.
    priceMin:
      // Continue the surrounding logic with this statement.
      criteria.priceMin !== undefined
        // Continue the surrounding logic with this statement.
        ? String(criteria.priceMin)
        // Continue the surrounding logic with this statement.
        : String(r.priceMin ?? '').trim(),
    // Provide the price max field value.
    priceMax:
      // Continue the surrounding logic with this statement.
      criteria.priceMax !== undefined
        // Continue the surrounding logic with this statement.
        ? String(criteria.priceMax)
        // Continue the surrounding logic with this statement.
        : String(r.priceMax ?? '').trim(),
    // Provide the seats min field value.
    seatsMin:
      // Continue the surrounding logic with this statement.
      criteria.seatsMin !== undefined
        // Continue the surrounding logic with this statement.
        ? String(criteria.seatsMin)
        // Continue the surrounding logic with this statement.
        : String(r.seatsMin ?? '').trim(),
    // Provide the seats max field value.
    seatsMax:
      // Continue the surrounding logic with this statement.
      criteria.seatsMax !== undefined
        // Continue the surrounding logic with this statement.
        ? String(criteria.seatsMax)
        // Continue the surrounding logic with this statement.
        : String(r.seatsMax ?? '').trim(),
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  parseCarFilterRaw,
  // Contribute this line to the enclosing declaration or statement.
  filterCarsByComputedUnitPrice,
  // Contribute this line to the enclosing declaration or statement.
  filtersViewModel,
};
