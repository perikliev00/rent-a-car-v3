/**
 * Admin order list views: active, expired, soft-deleted trash, and purge.
 * Lists expire finished orders first so status filters stay current.
 */
const orderSql = require('../../sql/orderSqlService');
// Destructure object properties into local variables.
const { expireFinishedOrders } = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../utils/timeZone');

// Create the allowed statuses constant.
const ALLOWED_STATUSES = orderSql.ALLOWED_STATUSES;

/** Normalize query-string filters for list endpoints. */
function mapFilters(query = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: query.status || '',
    // Provide the start date field value.
    startDate: query.startDate || '',
    // Provide the end date field value.
    endDate: query.endDate || '',
    // Provide the search field value.
    search: query.search || '',
  };
}

/**
 * Parse Sofia-local start/end date filters into a closed range for SQL.
 * Single-sided filters collapse to a point range on that day.
 */
function buildDateRangeFilters(filters) {
  // Initialize the mutable range start variable.
  let rangeStart = null;
  // Initialize the mutable range end variable.
  let rangeEnd = null;

  // Evaluate the condition and enter the branch when it is true.
  if (filters.startDate) {
    // Create the parsed constant.
    const parsed = parseSofiaDate(filters.startDate, '00:00');
    // Guard: early-return or throw when required input is missing/invalid.
    if (parsed && !Number.isNaN(parsed.getTime())) {
      // Update rangeStart with the right-hand side value.
      rangeStart = parsed;
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.endDate) {
    // Create the parsed constant.
    const parsed = parseSofiaDate(filters.endDate, '23:59');
    // Guard: early-return or throw when required input is missing/invalid.
    if (parsed && !Number.isNaN(parsed.getTime())) {
      // Update rangeEnd with the right-hand side value.
      rangeEnd = parsed;
    }
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!rangeStart && !rangeEnd) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the start constant.
  const start = rangeStart || rangeEnd;
  // Create the end constant.
  const end = rangeEnd || rangeStart;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!start || !end || start > end) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return { rangeStart: start, rangeEnd: end };
}

/**
 * Active (non-deleted) orders with optional status/search/date filters.
 * @param {object} [query]
 */
async function getOrdersList(query = {}) {
  // Wait until the asynchronous operation resolves.
  await expireFinishedOrders();

  // Create the filters constant.
  const filters = mapFilters(query);
  // Create the date range constant.
  const dateRange = buildDateRangeFilters(filters);

  // Create the orders constant.
  const orders = await orderSql.listOrders({
    // Provide the is deleted field value.
    isDeleted: false,
    // Provide the status field value.
    status: filters.status && ALLOWED_STATUSES.includes(filters.status)
      // Contribute this line to the enclosing declaration or statement.
      ? filters.status
      // Contribute this line to the enclosing declaration or statement.
      : undefined,
    // Provide the search field value.
    search: filters.search,
    // Provide the range start field value.
    rangeStart: dateRange?.rangeStart,
    // Provide the range end field value.
    rangeEnd: dateRange?.rangeEnd,
  });

  // Create the populated orders constant.
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  // Return the resulting value to the caller.
  return {
    // Provide the orders field value.
    orders: populatedOrders || [],
    // Contribute this line to the enclosing declaration or statement.
    filters,
  };
}

/** Soft-deleted=false orders already marked expired (after lifecycle expire pass). */
async function getExpiredOrders() {
  // Wait until the asynchronous operation resolves.
  await expireFinishedOrders();

  // Create the orders constant.
  const orders = await orderSql.listOrders({
    // Provide the is deleted field value.
    isDeleted: false,
    // Provide the status field value.
    status: 'expired',
    // Provide the sort by field value.
    sortBy: 'returnDateDesc',
  });

  // Create the populated orders constant.
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  // Return the resulting value to the caller.
  return {
    // Provide the orders field value.
    orders: populatedOrders || [],
  };
}

/** Soft-deleted orders in the recycle bin (newest deleted first). */
async function getDeletedOrders() {
  // Create the orders constant.
  const orders = await orderSql.listOrders({
    // Provide the is deleted field value.
    isDeleted: true,
    // Provide the sort by field value.
    sortBy: 'deletedAtDesc',
  });

  // Create the populated orders constant.
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  // Return the resulting value to the caller.
  return {
    // Provide the orders field value.
    orders: populatedOrders || [],
  };
}

/**
 * Hard-delete soft-deleted orders older than retention (default 30 days).
 * Configurable via DELETED_ORDERS_RETENTION_DAYS.
 */
async function emptyDeletedOrders() {
  // Create the retention days constant.
  const retentionDays = Number(process.env.DELETED_ORDERS_RETENTION_DAYS ?? 30);
  // Create the deleted count constant.
  const deletedCount = await orderSql.permanentlyDeleteSoftDeletedOrders({
    // Provide the retention days field value.
    retentionDays: Number.isFinite(retentionDays) && retentionDays >= 0 ? retentionDays : 30,
  });
  // Return the resulting value to the caller.
  return { deletedCount };
}

/** @param {number|string} id */
async function getOrderDetails(id) {
  // Return the resulting value to the caller.
  return orderSql.findOrderByIdPopulated(id);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getOrdersList,
  // Contribute this line to the enclosing declaration or statement.
  getExpiredOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  emptyDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  mapFilters,
  // Contribute this line to the enclosing declaration or statement.
  getOrderDetails,
};
