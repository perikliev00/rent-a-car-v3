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
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
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
  if (direct !== undefined && direct >= 1) {
    return direct;
  }

  // Legacy clients sent `category` as a numeric id.
  const legacyCategory = toNumOrUndef(raw?.category);
  if (legacyCategory !== undefined && legacyCategory >= 1) {
    return legacyCategory;
  }

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
  const {
    transmission,
    fuelType,
    seatsMin,
    seatsMax,
    priceMin,
    priceMax,
  } = raw;

  // Coerce strings to typed criteria; empty strings become '' / undefined as appropriate.
  return {
    categoryId: parseCategoryId(raw),
    transmission: norm(transmission),
    fuelType: norm(fuelType),
    seatsMin: toNumOrUndef(seatsMin),
    seatsMax: toNumOrUndef(seatsMax),
    priceMin: toNumOrUndef(priceMin),
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
    return cars;
  }
  return cars.filter((car) => {
    const unit = Number(car.unitPrice ?? car.price);
    if (criteria.priceMin !== undefined && (!Number.isFinite(unit) || unit < criteria.priceMin)) {
      return false;
    }
    if (criteria.priceMax !== undefined && (!Number.isFinite(unit) || unit > criteria.priceMax)) {
      return false;
    }
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
  const r = raw || {};
  return {
    categoryId: criteria.categoryId !== undefined ? String(criteria.categoryId) : '',
    transmission: criteria.transmission || '',
    fuelType: criteria.fuelType || '',
    priceMin:
      criteria.priceMin !== undefined
        ? String(criteria.priceMin)
        : String(r.priceMin ?? '').trim(),
    priceMax:
      criteria.priceMax !== undefined
        ? String(criteria.priceMax)
        : String(r.priceMax ?? '').trim(),
    seatsMin:
      criteria.seatsMin !== undefined
        ? String(criteria.seatsMin)
        : String(r.seatsMin ?? '').trim(),
    seatsMax:
      criteria.seatsMax !== undefined
        ? String(criteria.seatsMax)
        : String(r.seatsMax ?? '').trim(),
  };
}

module.exports = {
  parseCarFilterRaw,
  filterCarsByComputedUnitPrice,
  filtersViewModel,
};
