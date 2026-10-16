/**
 * Admin analytics range queries: KPIs, series, utilization, and per-car performance.
 */
import { api } from '../client';

export type AnalyticsKpis = {
  monthlyRevenue: number | null;
  weeklyBookings: number;
  occupancyRate: number;
  averageDailyRate: number | null;
  cancelledBookings: number;
  failedPayments: { total: number; unresolved: number };
  conversionRate: number;
  checkoutStarts: number;
  successfulBookings: number;
  abandonedHolds: number;
  orderCount: number | null;
  rentedDays: number;
  availableDays: number;
  activeCars: number;
};

export type CarPerformance = {
  carId: string;
  carName: string;
  registrationNumber: string | null;
  revenue: number | null;
  utilizationRate: number;
  bookedDays: number;
  availableDays: number;
  periodDays: number;
  bookingsCount: number;
  maintenanceDays: number;
  repairCost: number | null;
  serviceCost: number | null;
  profitability: number | null;
};

export type AnalyticsOverview = {
  from: string;
  to: string;
  periodDays: number;
  kpis: AnalyticsKpis;
  revenueSeries: Array<{ day: string; revenue: number; orders: number }>;
  bookingsSeries: Array<{ day: string; bookings: number }>;
  mostRentedCars: Array<{
    carId: string;
    carName: string;
    registrationNumber: string | null;
    bookingsCount: number;
    rentedDays: number;
  }>;
};

/**
 * Shared `from`/`to` query fragment for all analytics endpoints.
 * Values are URI-encoded so ISO dates with timezone markers stay safe.
 *
 * @param from - Range start (ISO / API date string)
 * @param to - Range end (ISO / API date string)
 */
function rangeQuery(from: string, to: string) {
  // Encode so `+` / special chars in timestamps do not break the query string.
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

/**
 * Dashboard overview: KPIs, revenue/bookings series, and most-rented cars.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getAnalyticsOverview(from: string, to: string): Promise<AnalyticsOverview> {
  return api(`/api/admin/analytics/overview?${rangeQuery(from, to)}`);
}

/**
 * Revenue aggregated per car for the selected window.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getRevenueByCar(
  from: string,
  to: string
): Promise<{ rows: Array<{ carId: string; carName: string; revenue: number | null; ordersCount: number }> }> {
  return api(`/api/admin/analytics/revenue-by-car?${rangeQuery(from, to)}`);
}

/**
 * Revenue aggregated per pickup/location for the selected window.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getRevenueByLocation(
  from: string,
  to: string
): Promise<{ rows: Array<{ location: string; revenue: number | null; ordersCount: number }> }> {
  return api(`/api/admin/analytics/revenue-by-location?${rangeQuery(from, to)}`);
}

/**
 * Fleet utilization rows (booked / maintenance / available days per car).
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getUtilization(
  from: string,
  to: string
): Promise<{
  periodDays: number;
  rows: Array<{
    carId: string;
    carName: string;
    bookedDays: number;
    maintenanceDays: number;
    availableDays: number;
    utilizationRate: number;
  }>;
}> {
  return api(`/api/admin/analytics/utilization?${rangeQuery(from, to)}`);
}

/**
 * Per-car performance table for the analytics “cars” view.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getCarsPerformance(
  from: string,
  to: string
): Promise<{ periodDays: number; rows: CarPerformance[] }> {
  return api(`/api/admin/analytics/cars?${rangeQuery(from, to)}`);
}

/**
 * Single-car performance detail (car detail Performance tab).
 *
 * @param carId - Target car id
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getCarPerformance(
  carId: string,
  from: string,
  to: string
): Promise<{ periodDays: number; car: CarPerformance }> {
  return api(`/api/admin/analytics/cars/${carId}?${rangeQuery(from, to)}`);
}
