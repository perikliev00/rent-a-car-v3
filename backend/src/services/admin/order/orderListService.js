/**
 * Admin order list views: active, expired, soft-deleted trash, and purge.
 * Lists expire finished orders first so status filters stay current.
 */
const orderSql = require('../../sql/orderSqlService');
const { expireFinishedOrders } = require('../../sql/bookingSyncSqlService');
const { parseSofiaDate } = require('../../../utils/timeZone');

const ALLOWED_STATUSES = orderSql.ALLOWED_STATUSES;

/** Normalize query-string filters for list endpoints. */
function mapFilters(query = {}) {
  return {
    status: query.status || '',
    startDate: query.startDate || '',
    endDate: query.endDate || '',
    search: query.search || '',
  };
}

/**
 * Parse Sofia-local start/end date filters into a closed range for SQL.
 * Single-sided filters collapse to a point range on that day.
 */
function buildDateRangeFilters(filters) {
  let rangeStart = null;
  let rangeEnd = null;

  if (filters.startDate) {
    const parsed = parseSofiaDate(filters.startDate, '00:00');
    // Guard: early-return or throw when required input is missing/invalid.
    if (parsed && !Number.isNaN(parsed.getTime())) {
      rangeStart = parsed;
    }
  }
  if (filters.endDate) {
    const parsed = parseSofiaDate(filters.endDate, '23:59');
    // Guard: early-return or throw when required input is missing/invalid.
    if (parsed && !Number.isNaN(parsed.getTime())) {
      rangeEnd = parsed;
    }
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!rangeStart && !rangeEnd) {
    return null;
  }

  const start = rangeStart || rangeEnd;
  const end = rangeEnd || rangeStart;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!start || !end || start > end) {
    return null;
  }

  return { rangeStart: start, rangeEnd: end };
}

/**
 * Active (non-deleted) orders with optional status/search/date filters.
 * @param {object} [query]
 */
async function getOrdersList(query = {}) {
  await expireFinishedOrders();

  const filters = mapFilters(query);
  const dateRange = buildDateRangeFilters(filters);

  const orders = await orderSql.listOrders({
    isDeleted: false,
    status: filters.status && ALLOWED_STATUSES.includes(filters.status)
      ? filters.status
      : undefined,
    search: filters.search,
    rangeStart: dateRange?.rangeStart,
    rangeEnd: dateRange?.rangeEnd,
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
    filters,
  };
}

/** Soft-deleted=false orders already marked expired (after lifecycle expire pass). */
async function getExpiredOrders() {
  await expireFinishedOrders();

  const orders = await orderSql.listOrders({
    isDeleted: false,
    status: 'expired',
    sortBy: 'returnDateDesc',
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
  };
}

/** Soft-deleted orders in the recycle bin (newest deleted first). */
async function getDeletedOrders() {
  const orders = await orderSql.listOrders({
    isDeleted: true,
    sortBy: 'deletedAtDesc',
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
  };
}

/**
 * Hard-delete soft-deleted orders older than retention (default 30 days).
 * Configurable via DELETED_ORDERS_RETENTION_DAYS.
 */
async function emptyDeletedOrders() {
  const retentionDays = Number(process.env.DELETED_ORDERS_RETENTION_DAYS ?? 30);
  const deletedCount = await orderSql.permanentlyDeleteSoftDeletedOrders({
    retentionDays: Number.isFinite(retentionDays) && retentionDays >= 0 ? retentionDays : 30,
  });
  return { deletedCount };
}

/** @param {number|string} id */
async function getOrderDetails(id) {
  return orderSql.findOrderByIdPopulated(id);
}

module.exports = {
  getOrdersList,
  getExpiredOrders,
  getDeletedOrders,
  emptyDeletedOrders,
  mapFilters,
  getOrderDetails,
};
