// =============================================================================
// carFilters.js – обща нормализация и филтри за gallery (home) и search
// =============================================================================

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function toNumOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseCategoryId(raw) {
  const direct = toNumOrUndef(raw?.categoryId);
  if (direct !== undefined && direct >= 1) {
    return direct;
  }

  const legacyCategory = toNumOrUndef(raw?.category);
  if (legacyCategory !== undefined && legacyCategory >= 1) {
    return legacyCategory;
  }

  return undefined;
}

/**
 * Нормализира сурови полета (query или body) до ефективни критерии за кола.
 *
 * @param {Record<string, unknown>} raw
 * @returns {{
 *   categoryId?: number,
 *   transmission: string,
 *   fuelType: string,
 *   seatsMin?: number,
 *   seatsMax?: number,
 *   priceMin?: number,
 *   priceMax?: number
 * }}
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
 * Точен филтър по дневна/unit цена след computeBookingPrice.
 *
 * @param {Array<Record<string, unknown>>} cars
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 */
function filterCarsByComputedUnitPrice(cars, criteria) {
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
 * Стойности за API `filters` при gallery/search.
 *
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 * @param {Record<string, unknown>} [raw] – оригинални низове при липсващи числа
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
