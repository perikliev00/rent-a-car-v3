/**
 * Analytics application service: KPIs, series, utilization, car performance, CSV.
 *
 * Monetary fields are null/omitted without can_view_revenue. Occupancy treats
 * maintenance block days as unavailable capacity subtracted from fleet days.
 */

const repo = require('./analytics.repository');
const { periodDayCount } = require('./analytics.domain');
const rbacService = require('../../services/rbac/rbacService');

/** Enforce from <= to and max 366-day window. */
function assertValidRange(from, to) {
  if (!from || !to || from > to) {
    const err = new Error('Invalid date range: from must be on or before to');
    err.status = 422;
    err.code = 'INVALID_DATE_RANGE';
    throw err;
  }
  // Cap at one leap-year length to keep SQL aggregates bounded.
  const days = periodDayCount(from, to);
  if (days > 366) {
    const err = new Error('Date range cannot exceed 366 days');
    err.status = 422;
    err.code = 'DATE_RANGE_TOO_LARGE';
    throw err;
  }
}

/** @param {object} access @returns {boolean} */
function canViewRevenue(access) {
  return rbacService.userHasPermission(access, 'can_view_revenue');
}

/** Hide money when the caller lacks revenue permission. */
function maskMoney(value, allowed) {
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
  const utilizationRate =
    availableDays > 0 ? Number(raw.bookedDays || 0) / availableDays : 0;
  const revenue = Number(raw.revenue || 0);
  const repairCost = Number(raw.repairCost || 0);
  const serviceCost = Number(raw.serviceCost || 0);
  const profitability = revenue - repairCost - serviceCost;

  return {
    carId: raw.carId,
    carName: raw.carName,
    registrationNumber: raw.registrationNumber || null,
    revenue: maskMoney(revenue, canMoney),
    utilizationRate: Math.round(utilizationRate * 10000) / 10000,
    bookedDays: Number(raw.bookedDays || 0),
    availableDays,
    periodDays,
    bookingsCount: Number(raw.bookingsCount || 0),
    maintenanceDays: Number(raw.maintenanceDays || 0),
    repairCost: maskMoney(repairCost, canMoney),
    serviceCost: maskMoney(serviceCost, canMoney),
    profitability: maskMoney(profitability, canMoney),
  };
}

/**
 * Dashboard overview: KPI cards + revenue/bookings series + most-rented cars.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getOverview({ from, to, access }) {
  assertValidRange(from, to);
  const canMoney = canViewRevenue(access);
  const periodDays = periodDayCount(from, to);

  // Parallel fetch of all overview query slices.
  const [
    revenueTotals,
    revenueSeries,
    weeklyBookings,
    bookingsSeries,
    cancelled,
    failedPayments,
    conversion,
    occupancy,
    mostRented,
  ] = await Promise.all([
    repo.getRevenueTotals({ from, to }),
    repo.getRevenueSeries({ from, to }),
    repo.getConfirmedBookingsCount({ from, to }),
    repo.getBookingsSeries({ from, to }),
    repo.getCancelledBookingsCount({ from, to }),
    repo.getFailedPaymentsStats({ from, to }),
    repo.getConversionStats({ from, to }),
    repo.getOccupancyStats({ from, to }),
    repo.getMostRentedCars({ from, to, limit: 10 }),
  ]);

  // ADR = revenue / rental_days from orders (not calendar overlap days).
  const revenue = Number(revenueTotals.revenue || 0);
  const rentalDays = Number(revenueTotals.rental_days || 0);
  const adr = rentalDays > 0 ? revenue / rentalDays : 0;

  // Occupancy: rented overlap / (fleet capacity − maintenance days).
  const fleetCapacity = occupancy.activeCars * periodDays;
  const availableDays = Math.max(fleetCapacity - occupancy.maintenanceDays, 0);
  const occupancyRate =
    availableDays > 0 ? occupancy.rentedDays / availableDays : 0;

  // Conversion: confirmed / checkout starts (history + stripe session funnel).
  const checkoutStarts = Number(conversion.checkout_starts || 0);
  const successful = Number(conversion.successful_bookings || 0);
  const conversionRate = checkoutStarts > 0 ? successful / checkoutStarts : 0;

  return {
    from,
    to,
    periodDays,
    kpis: {
      monthlyRevenue: maskMoney(revenue, canMoney),
      weeklyBookings,
      occupancyRate: Math.round(occupancyRate * 10000) / 10000,
      averageDailyRate: maskMoney(Math.round(adr * 100) / 100, canMoney),
      cancelledBookings: cancelled,
      failedPayments: {
        total: Number(failedPayments.total || 0),
        unresolved: Number(failedPayments.unresolved || 0),
      },
      conversionRate: Math.round(conversionRate * 10000) / 10000,
      checkoutStarts,
      successfulBookings: successful,
      abandonedHolds: Number(conversion.abandoned_holds || 0),
      orderCount: canMoney ? Number(revenueTotals.order_count || 0) : null,
      rentedDays: occupancy.rentedDays,
      availableDays,
      activeCars: occupancy.activeCars,
    },
    revenueSeries: canMoney
      ? revenueSeries.map((r) => ({
          day: r.day,
          revenue: Number(r.revenue),
          orders: Number(r.orders),
        }))
      : [],
    bookingsSeries: bookingsSeries.map((r) => ({
      day: r.day,
      bookings: Number(r.bookings),
    })),
    mostRentedCars: mostRented.map((r) => ({
      carId: String(r.car_id),
      carName: r.car_name,
      registrationNumber: r.registration_number || null,
      bookingsCount: Number(r.bookings_count),
      rentedDays: Number(r.rented_days),
    })),
  };
}

/**
 * Revenue breakdown by car for the date range.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getRevenueByCar({ from, to, access }) {
  assertValidRange(from, to);
  const canMoney = canViewRevenue(access);
  const rows = await repo.getRevenueByCar({ from, to });
  // Mask revenue when caller lacks can_view_revenue; counts stay visible.
  return {
    from,
    to,
    rows: rows.map((r) => ({
      carId: String(r.car_id),
      carName: r.car_name,
      registrationNumber: r.registration_number || null,
      revenue: maskMoney(Number(r.revenue), canMoney),
      ordersCount: Number(r.orders_count),
      rentalDays: Number(r.rental_days),
    })),
  };
}

/**
 * Revenue breakdown by pickup location.
 * @param {{ from: string, to: string, access: object }} args
 */
async function getRevenueByLocation({ from, to, access }) {
  assertValidRange(from, to);
  const canMoney = canViewRevenue(access);
  const rows = await repo.getRevenueByLocation({ from, to });
  return {
    from,
    to,
    rows: rows.map((r) => ({
      location: r.location,
      revenue: maskMoney(Number(r.revenue), canMoney),
      ordersCount: Number(r.orders_count),
    })),
  };
}

/**
 * Per-car utilization (no money fields).
 * @param {{ from: string, to: string }} args
 */
async function getUtilization({ from, to }) {
  assertValidRange(from, to);
  const periodDays = periodDayCount(from, to);
  const rows = await repo.getUtilizationByCar({ from, to });
  return {
    from,
    to,
    periodDays,
    rows: rows.map((r) => {
      // Same availableDays formula as performance rows (period − maintenance).
      const maintenanceDays = Number(r.maintenance_days || 0);
      const bookedDays = Number(r.booked_days || 0);
      const availableDays = Math.max(periodDays - maintenanceDays, 0);
      const utilizationRate = availableDays > 0 ? bookedDays / availableDays : 0;
      return {
        carId: String(r.car_id),
        carName: r.car_name,
        registrationNumber: r.registration_number || null,
        bookedDays,
        maintenanceDays,
        availableDays,
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
  assertValidRange(from, to);
  const canMoney = canViewRevenue(access);
  const periodDays = periodDayCount(from, to);
  const raw = await repo.listCarPerformance({ from, to });
  return {
    from,
    to,
    periodDays,
    rows: raw.map((r) => buildPerformanceRow(r, periodDays, canMoney)),
  };
}

/**
 * Single-car performance detail.
 * @param {{ carId: number, from: string, to: string, access: object }} args
 */
async function getCarPerformance({ carId, from, to, access }) {
  assertValidRange(from, to);
  const canMoney = canViewRevenue(access);
  const periodDays = periodDayCount(from, to);
  const raw = await repo.getCarPerformance({ carId, from, to });
  if (!raw) {
    const err = new Error('Car not found');
    err.status = 404;
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }
  return {
    from,
    to,
    periodDays,
    car: buildPerformanceRow(raw, periodDays, canMoney),
  };
}

/**
 * Minimal CSV serializer with quote escaping.
 * @param {object[]} rows
 * @param {{ key: string, label: string }[]} columns
 */
function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val == null) return '';
        const str = String(val);
        // RFC-style escaping when value contains comma or quote.
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
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
    { key: 'carId', label: 'car_id' },
    { key: 'carName', label: 'car_name' },
    { key: 'registrationNumber', label: 'registration_number' },
    { key: 'revenue', label: 'revenue' },
    { key: 'bookingsCount', label: 'bookings_count' },
    { key: 'utilizationRate', label: 'utilization_rate' },
    { key: 'maintenanceDays', label: 'maintenance_days' },
    { key: 'repairCost', label: 'repair_cost' },
    { key: 'serviceCost', label: 'service_cost' },
    { key: 'profitability', label: 'profitability' },
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
  periodDayCount,
  assertValidRange,
};
