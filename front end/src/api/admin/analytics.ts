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

function rangeQuery(from: string, to: string) {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function getAnalyticsOverview(from: string, to: string): Promise<AnalyticsOverview> {
  return api(`/api/admin/analytics/overview?${rangeQuery(from, to)}`);
}

export async function getRevenueByCar(
  from: string,
  to: string
): Promise<{ rows: Array<{ carId: string; carName: string; revenue: number | null; ordersCount: number }> }> {
  return api(`/api/admin/analytics/revenue-by-car?${rangeQuery(from, to)}`);
}

export async function getRevenueByLocation(
  from: string,
  to: string
): Promise<{ rows: Array<{ location: string; revenue: number | null; ordersCount: number }> }> {
  return api(`/api/admin/analytics/revenue-by-location?${rangeQuery(from, to)}`);
}

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

export async function getCarsPerformance(
  from: string,
  to: string
): Promise<{ periodDays: number; rows: CarPerformance[] }> {
  return api(`/api/admin/analytics/cars?${rangeQuery(from, to)}`);
}

export async function getCarPerformance(
  carId: string,
  from: string,
  to: string
): Promise<{ periodDays: number; car: CarPerformance }> {
  return api(`/api/admin/analytics/cars/${carId}?${rangeQuery(from, to)}`);
}
