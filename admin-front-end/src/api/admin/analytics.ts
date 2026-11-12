/**
 * Admin analytics range queries: KPIs, series, utilization, and per-car performance.
 */
import { api } from '../client';

// Export the analytics kpis type.
export type AnalyticsKpis = {
  // Provide the monthly revenue field value.
  monthlyRevenue: number | null;
  // Provide the weekly bookings field value.
  weeklyBookings: number;
  // Provide the occupancy rate field value.
  occupancyRate: number;
  // Provide the average daily rate field value.
  averageDailyRate: number | null;
  // Provide the cancelled bookings field value.
  cancelledBookings: number;
  // Provide the failed payments field value.
  failedPayments: { total: number; unresolved: number };
  // Provide the conversion rate field value.
  conversionRate: number;
  // Provide the checkout starts field value.
  checkoutStarts: number;
  // Provide the successful bookings field value.
  successfulBookings: number;
  // Provide the abandoned holds field value.
  abandonedHolds: number;
  // Provide the order count field value.
  orderCount: number | null;
  // Provide the rented days field value.
  rentedDays: number;
  // Provide the available days field value.
  availableDays: number;
  // Provide the active cars field value.
  activeCars: number;
};

// Export the car performance type.
export type CarPerformance = {
  // Provide the car id field value.
  carId: string;
  // Provide the car name field value.
  carName: string;
  // Provide the registration number field value.
  registrationNumber: string | null;
  // Provide the revenue field value.
  revenue: number | null;
  // Provide the utilization rate field value.
  utilizationRate: number;
  // Provide the booked days field value.
  bookedDays: number;
  // Provide the available days field value.
  availableDays: number;
  // Provide the period days field value.
  periodDays: number;
  // Provide the bookings count field value.
  bookingsCount: number;
  // Provide the maintenance days field value.
  maintenanceDays: number;
  // Provide the repair cost field value.
  repairCost: number | null;
  // Provide the service cost field value.
  serviceCost: number | null;
  // Provide the profitability field value.
  profitability: number | null;
};

// Export the analytics overview type.
export type AnalyticsOverview = {
  // Provide the from field value.
  from: string;
  // Provide the to field value.
  to: string;
  // Provide the period days field value.
  periodDays: number;
  // Provide the kpis field value.
  kpis: AnalyticsKpis;
  // Provide the revenue series field value.
  revenueSeries: Array<{ day: string; revenue: number; orders: number }>;
  // Provide the bookings series field value.
  bookingsSeries: Array<{ day: string; bookings: number }>;
  // Provide the most rented cars field value.
  mostRentedCars: Array<{
    // Provide the car id field value.
    carId: string;
    // Provide the car name field value.
    carName: string;
    // Provide the registration number field value.
    registrationNumber: string | null;
    // Provide the bookings count field value.
    bookingsCount: number;
    // Provide the rented days field value.
    rentedDays: number;
  // Continue the surrounding logic with this statement.
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
  // Return the resulting value to the caller.
  return api(`/api/admin/analytics/overview?${rangeQuery(from, to)}`);
}

/**
 * Revenue aggregated per car for the selected window.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getRevenueByCar(
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ rows: Array<{ carId: string; carName: string; revenue: number | null; ordersCount: number }> }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/analytics/revenue-by-car?${rangeQuery(from, to)}`);
}

/**
 * Revenue aggregated per pickup/location for the selected window.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getRevenueByLocation(
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ rows: Array<{ location: string; revenue: number | null; ordersCount: number }> }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/analytics/revenue-by-location?${rangeQuery(from, to)}`);
}

/**
 * Fleet utilization rows (booked / maintenance / available days per car).
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getUtilization(
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{
  // Provide the period days field value.
  periodDays: number;
  // Provide the rows field value.
  rows: Array<{
    // Provide the car id field value.
    carId: string;
    // Provide the car name field value.
    carName: string;
    // Provide the booked days field value.
    bookedDays: number;
    // Provide the maintenance days field value.
    maintenanceDays: number;
    // Provide the available days field value.
    availableDays: number;
    // Provide the utilization rate field value.
    utilizationRate: number;
  // Continue the surrounding logic with this statement.
  }>;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api(`/api/admin/analytics/utilization?${rangeQuery(from, to)}`);
}

/**
 * Per-car performance table for the analytics “cars” view.
 *
 * @param from - Inclusive range start
 * @param to - Inclusive range end
 */
export async function getCarsPerformance(
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ periodDays: number; rows: CarPerformance[] }> {
  // Return the resulting value to the caller.
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
  // Provide the car id field value.
  carId: string,
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ periodDays: number; car: CarPerformance }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/analytics/cars/${carId}?${rangeQuery(from, to)}`);
}
