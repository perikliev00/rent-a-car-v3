/**
 * Analytics application service: KPIs, series, utilization, car performance, CSV.
 *
 * Monetary fields are null/omitted without can_view_revenue. Occupancy treats
 * maintenance block days as unavailable capacity subtracted from fleet days.
 */

const repo = require('./analytics.repository');
// Destructure object properties into local variables.
const { periodDayCount } = require('./analytics.domain');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');

/** Enforce from <= to and max 366-day window. */
function assertValidRange(from, to) {
  // Evaluate the condition and enter the branch when it is true.
  if (!from || !to || from > to) {
    // Create the err constant.
    const err = new Error('Invalid date range: from must be on or before to');
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Update err.code with the right-hand side value.
    err.code = 'INVALID_DATE_RANGE';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Cap at one leap-year length to keep SQL aggregates bounded.
  const days = periodDayCount(from, to);
  // Evaluate the condition and enter the branch when it is true.
  if (days > 366) {
    // Create the err constant.
    const err = new Error('Date range cannot exceed 366 days');
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Update err.code with the right-hand side value.
    err.code = 'DATE_RANGE_TOO_LARGE';
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/** @param {object} access @returns {boolean} */
function canViewRevenue(access) {
  // Return the resulting value to the caller.
  return rbacService.userHasPermission(access, 'can_view_revenue');
}

/** Hide money when the caller lacks revenue permission. */
function maskMoney(value, allowed) {
  // Return the resulting value to the caller.
  return allowed ? value : null;
}

/**
 * Derive utilization and profitability for one car over the period.
 * availableDays = periodDays - maintenanceDays; rate = booked / available.
 * @param {object} raw Raw performance row from repository
 * @param {number} periodDays Inclusive day count of the report window
 * @param {boolean} canMoney Whether revenue/cost fields may be exposed
 */
function buildPerformanceRow(raw, periodDays, canMoney) {
  // Maintenance days reduce available capacity for utilization.
  const availableDays = Math.max(periodDays - Number(raw.maintenanceDays || 0), 0);
  // Create the utilization rate constant.
  const utilizationRate =
    // Continue the surrounding logic with this statement.
    availableDays > 0 ? Number(raw.bookedDays || 0) / availableDays : 0;
  // Create the revenue constant.
  const revenue = Number(raw.revenue || 0);
  // Create the repair cost constant.
  const repairCost = Number(raw.repairCost || 0);
  // Create the service cost constant.
  const serviceCost = Number(raw.serviceCost || 0);
  // Create the profitability constant.
  const profitability = revenue - repairCost - serviceCost;

  // Return the resulting value to the caller.
  return {
    // Provide the car id field value.
    carId: raw.carId,
    // Provide the car name field value.
    carName: raw.carName,
    // Provide the registration number field value.
    registrationNumber: raw.registrationNumber || null,
    // Provide the revenue field value.
    revenue: maskMoney(revenue, canMoney),
    // Provide the utilization rate field value.
    utilizationRate: Math.round(utilizationRate * 10000) / 10000,
    // Provide the booked days field value.
    bookedDays: Number(raw.bookedDays || 0),
    // Contribute this line to the enclosing declaration or statement.
    availableDays,
    // Contribute this line to the enclosing declaration or statement.
    periodDays,
    // Provide the bookings count field value.
    bookingsCount: Number(raw.bookingsCount || 0),
    // Provide the maintenance days field value.
    maintenanceDays: Number(raw.maintenanceDays || 0),
    // Provide the repair cost field value.
    repairCost: maskMoney(repairCost, canMoney),
    // Provide the service cost field value.
    serviceCost: maskMoney(serviceCost, canMoney),
    // Provide the profitability field value.
    profitability: maskMoney(profitability, canMoney),
  };
}

/**
 * Dashboard overview: KPI cards + revenue/bookings series + most-rented cars.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getOverview({ from, to, access }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the can money constant.
  const canMoney = canViewRevenue(access);
  // Create the period days constant.
  const periodDays = periodDayCount(from, to);

  // Parallel fetch of all overview query slices.
  const [
    // Contribute this line to the enclosing declaration or statement.
    revenueTotals,
    // Contribute this line to the enclosing declaration or statement.
    revenueSeries,
    // Contribute this line to the enclosing declaration or statement.
    weeklyBookings,
    // Contribute this line to the enclosing declaration or statement.
    bookingsSeries,
    // Contribute this line to the enclosing declaration or statement.
    cancelled,
    // Contribute this line to the enclosing declaration or statement.
    failedPayments,
    // Contribute this line to the enclosing declaration or statement.
    conversion,
    // Contribute this line to the enclosing declaration or statement.
    occupancy,
    // Contribute this line to the enclosing declaration or statement.
    mostRented,
  // Store the awaited result in ].
  ] = await Promise.all([
    // Call repo.getRevenueTotals to perform this step.
    repo.getRevenueTotals({ from, to }),
    // Call repo.getRevenueSeries to perform this step.
    repo.getRevenueSeries({ from, to }),
    // Call repo.getConfirmedBookingsCount to perform this step.
    repo.getConfirmedBookingsCount({ from, to }),
    // Call repo.getBookingsSeries to perform this step.
    repo.getBookingsSeries({ from, to }),
    // Call repo.getCancelledBookingsCount to perform this step.
    repo.getCancelledBookingsCount({ from, to }),
    // Call repo.getFailedPaymentsStats to perform this step.
    repo.getFailedPaymentsStats({ from, to }),
    // Call repo.getConversionStats to perform this step.
    repo.getConversionStats({ from, to }),
    // Call repo.getOccupancyStats to perform this step.
    repo.getOccupancyStats({ from, to }),
    // Call repo.getMostRentedCars to perform this step.
    repo.getMostRentedCars({ from, to, limit: 10 }),
  ]);

  // ADR = revenue / rental_days from orders (not calendar overlap days).
  const revenue = Number(revenueTotals.revenue || 0);
  // Create the rental days constant.
  const rentalDays = Number(revenueTotals.rental_days || 0);
  // Create the adr constant.
  const adr = rentalDays > 0 ? revenue / rentalDays : 0;

  // Occupancy: rented overlap / (fleet capacity − maintenance days).
  const fleetCapacity = occupancy.activeCars * periodDays;
  // Create the available days constant.
  const availableDays = Math.max(fleetCapacity - occupancy.maintenanceDays, 0);
  // Create the occupancy rate constant.
  const occupancyRate =
    // Continue the surrounding logic with this statement.
    availableDays > 0 ? occupancy.rentedDays / availableDays : 0;

  // Conversion: confirmed / checkout starts (history + stripe session funnel).
  const checkoutStarts = Number(conversion.checkout_starts || 0);
  // Create the successful constant.
  const successful = Number(conversion.successful_bookings || 0);
  // Create the conversion rate constant.
  const conversionRate = checkoutStarts > 0 ? successful / checkoutStarts : 0;

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Contribute this line to the enclosing declaration or statement.
    periodDays,
    // Provide the kpis field value.
    kpis: {
      // Provide the monthly revenue field value.
      monthlyRevenue: maskMoney(revenue, canMoney),
      // Contribute this line to the enclosing declaration or statement.
      weeklyBookings,
      // Provide the occupancy rate field value.
      occupancyRate: Math.round(occupancyRate * 10000) / 10000,
      // Provide the average daily rate field value.
      averageDailyRate: maskMoney(Math.round(adr * 100) / 100, canMoney),
      // Provide the cancelled bookings field value.
      cancelledBookings: cancelled,
      // Provide the failed payments field value.
      failedPayments: {
        // Provide the total field value.
        total: Number(failedPayments.total || 0),
        // Provide the unresolved field value.
        unresolved: Number(failedPayments.unresolved || 0),
      },
      // Provide the conversion rate field value.
      conversionRate: Math.round(conversionRate * 10000) / 10000,
      // Contribute this line to the enclosing declaration or statement.
      checkoutStarts,
      // Provide the successful bookings field value.
      successfulBookings: successful,
      // Provide the abandoned holds field value.
      abandonedHolds: Number(conversion.abandoned_holds || 0),
      // Provide the order count field value.
      orderCount: canMoney ? Number(revenueTotals.order_count || 0) : null,
      // Provide the rented days field value.
      rentedDays: occupancy.rentedDays,
      // Contribute this line to the enclosing declaration or statement.
      availableDays,
      // Provide the active cars field value.
      activeCars: occupancy.activeCars,
    },
    // Provide the revenue series field value.
    revenueSeries: canMoney
      // Continue the surrounding logic with this statement.
      ? revenueSeries.map((r) => ({
          // Provide the day field value.
          day: r.day,
          // Provide the revenue field value.
          revenue: Number(r.revenue),
          // Provide the orders field value.
          orders: Number(r.orders),
        }))
      // Contribute this line to the enclosing declaration or statement.
      : [],
    // Provide the bookings series field value.
    bookingsSeries: bookingsSeries.map((r) => ({
      // Provide the day field value.
      day: r.day,
      // Provide the bookings field value.
      bookings: Number(r.bookings),
    })),
    // Provide the most rented cars field value.
    mostRentedCars: mostRented.map((r) => ({
      // Provide the car id field value.
      carId: String(r.car_id),
      // Provide the car name field value.
      carName: r.car_name,
      // Provide the registration number field value.
      registrationNumber: r.registration_number || null,
      // Provide the bookings count field value.
      bookingsCount: Number(r.bookings_count),
      // Provide the rented days field value.
      rentedDays: Number(r.rented_days),
    })),
  };
}

/**
 * Revenue breakdown by car for the date range.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getRevenueByCar({ from, to, access }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the can money constant.
  const canMoney = canViewRevenue(access);
  // Create the rows constant.
  const rows = await repo.getRevenueByCar({ from, to });
  // Mask revenue when caller lacks can_view_revenue; counts stay visible.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Provide the rows field value.
    rows: rows.map((r) => ({
      // Provide the car id field value.
      carId: String(r.car_id),
      // Provide the car name field value.
      carName: r.car_name,
      // Provide the registration number field value.
      registrationNumber: r.registration_number || null,
      // Provide the revenue field value.
      revenue: maskMoney(Number(r.revenue), canMoney),
      // Provide the orders count field value.
      ordersCount: Number(r.orders_count),
      // Provide the rental days field value.
      rentalDays: Number(r.rental_days),
    })),
  };
}

/**
 * Revenue breakdown by pickup location.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getRevenueByLocation({ from, to, access }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the can money constant.
  const canMoney = canViewRevenue(access);
  // Create the rows constant.
  const rows = await repo.getRevenueByLocation({ from, to });
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Provide the rows field value.
    rows: rows.map((r) => ({
      // Provide the location field value.
      location: r.location,
      // Provide the revenue field value.
      revenue: maskMoney(Number(r.revenue), canMoney),
      // Provide the orders count field value.
      ordersCount: Number(r.orders_count),
    })),
  };
}

/**
 * Per-car utilization (no money fields).
 * @param {{ from: string, to: string }} args
 */
async function getUtilization({ from, to }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the period days constant.
  const periodDays = periodDayCount(from, to);
  // Create the rows constant.
  const rows = await repo.getUtilizationByCar({ from, to });
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Contribute this line to the enclosing declaration or statement.
    periodDays,
    // Provide the rows field value.
    rows: rows.map((r) => {
      // Same availableDays formula as performance rows (period − maintenance).
      const maintenanceDays = Number(r.maintenance_days || 0);
      // Create the booked days constant.
      const bookedDays = Number(r.booked_days || 0);
      // Create the available days constant.
      const availableDays = Math.max(periodDays - maintenanceDays, 0);
      // Create the utilization rate constant.
      const utilizationRate = availableDays > 0 ? bookedDays / availableDays : 0;
      // Return the resulting value to the caller.
      return {
        // Provide the car id field value.
        carId: String(r.car_id),
        // Provide the car name field value.
        carName: r.car_name,
        // Provide the registration number field value.
        registrationNumber: r.registration_number || null,
        // Contribute this line to the enclosing declaration or statement.
        bookedDays,
        // Contribute this line to the enclosing declaration or statement.
        maintenanceDays,
        // Contribute this line to the enclosing declaration or statement.
        availableDays,
        // Provide the utilization rate field value.
        utilizationRate: Math.round(utilizationRate * 10000) / 10000,
      };
    }),
  };
}

/**
 * Fleet performance table including costs and profitability when allowed.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getCarsPerformance({ from, to, access }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the can money constant.
  const canMoney = canViewRevenue(access);
  // Create the period days constant.
  const periodDays = periodDayCount(from, to);
  // Create the raw constant.
  const raw = await repo.listCarPerformance({ from, to });
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Contribute this line to the enclosing declaration or statement.
    periodDays,
    // Provide the rows field value.
    rows: raw.map((r) => buildPerformanceRow(r, periodDays, canMoney)),
  };
}

/**
 * Single-car performance detail.
 * @param {{ carId: number, from: string, to: string, access: object }} args
 */
async function getCarPerformance({ carId, from, to, access }) {
  // Call assertValidRange to perform this step.
  assertValidRange(from, to);
  // Create the can money constant.
  const canMoney = canViewRevenue(access);
  // Create the period days constant.
  const periodDays = periodDayCount(from, to);
  // Create the raw constant.
  const raw = await repo.getCarPerformance({ carId, from, to });
  // Evaluate the condition and enter the branch when it is true.
  if (!raw) {
    // Create the err constant.
    const err = new Error('Car not found');
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Update err.code with the right-hand side value.
    err.code = 'CAR_NOT_FOUND';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    from,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Contribute this line to the enclosing declaration or statement.
    periodDays,
    // Provide the car field value.
    car: buildPerformanceRow(raw, periodDays, canMoney),
  };
}

/**
 * Keep spreadsheet apps from treating fleet text as a formula.
 * A leading apostrophe is the literal-text marker for Excel and Google Sheets.
 * @param {string} value
 * @returns {string}
 */
function neutralizeSpreadsheetText(value) {
  // Evaluate the condition and enter the branch when it is true.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(value)) {
    // Return the resulting value to the caller.
    return `'${value}`;
  }
  // Return the resulting value to the caller.
  return value;
}

/**
 * @param {string} value
 * @returns {string}
 */
function quoteCsv(value) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV serializer. Numeric columns stay numbers, including legitimate negatives.
 * Text columns are neutralized when they would be read as formulas.
 * @param {object[]} rows
 * @param {{ key: string, label: string, kind?: 'text'|'number' }[]} columns
 */
function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const val = row[column.key];
        if (val == null || val === '') return '';
        if (column.kind === 'number') {
          if (typeof val === 'number' && Number.isFinite(val)) return String(val);
          const numeric = String(val);
          if (/^-?\d+(\.\d+)?$/.test(numeric)) return numeric;
          return quoteCsv(neutralizeSpreadsheetText(numeric));
        }
        return quoteCsv(neutralizeSpreadsheetText(String(val)));
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * Export car performance as CSV; requires can_export_reports.
 * Money columns omitted without can_view_revenue.
 * @param {{ from: string, to: string, access: object }} args
 */
async function exportCsv({ from, to, access }) {
  assertValidRange(from, to);
  if (!rbacService.userHasPermission(access, 'can_export_reports')) {
    const err = new Error('You do not have permission to export reports');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  const canMoney = canViewRevenue(access);
  const { rows } = await getCarsPerformance({ from, to, access });
  // Drop money columns when revenue permission is missing.
  return toCsv(rows, [
    { key: 'carId', label: 'car_id', kind: 'text' },
    { key: 'carName', label: 'car_name', kind: 'text' },
    { key: 'registrationNumber', label: 'registration_number', kind: 'text' },
    { key: 'revenue', label: 'revenue', kind: 'number' },
    { key: 'bookingsCount', label: 'bookings_count', kind: 'number' },
    { key: 'utilizationRate', label: 'utilization_rate', kind: 'number' },
    { key: 'maintenanceDays', label: 'maintenance_days', kind: 'number' },
    { key: 'repairCost', label: 'repair_cost', kind: 'number' },
    { key: 'serviceCost', label: 'service_cost', kind: 'number' },
    { key: 'profitability', label: 'profitability', kind: 'number' },
  ].filter((c) => canMoney || !['revenue', 'repairCost', 'serviceCost', 'profitability'].includes(c.key)));
}

module.exports = {
  getOverview,
  getRevenueByCar,
  getRevenueByLocation,
  getUtilization,
  getCarsPerformance,
  getCarPerformance,
  exportCsv,
  toCsv,
  periodDayCount,
  assertValidRange,
};
