import type { OpsReservationRow } from '../../../api/admin/reservations';

export function emptyWidgets() {
  return {
    todaysPickups: [] as OpsReservationRow[],
    todaysReturns: [] as OpsReservationRow[],
    activeRentals: [] as OpsReservationRow[],
    overdueReturns: [] as OpsReservationRow[],
    manualReview: [] as OpsReservationRow[],
    paidNotConfirmed: [] as OpsReservationRow[],
    cancelled: [] as OpsReservationRow[],
    failedPayments: [] as OpsReservationRow[],
  };
}

export const WIDGET_META: { key: keyof ReturnType<typeof emptyWidgets>; title: string; hint: string }[] = [
  { key: 'todaysPickups', title: "Today's Pickups", hint: 'Confirmed / prepared for pickup today' },
  { key: 'todaysReturns', title: "Today's Returns", hint: 'Out on rental, due back today' },
  { key: 'activeRentals', title: 'Active Rentals', hint: 'Picked up or active rental' },
  { key: 'overdueReturns', title: 'Overdue Returns', hint: 'Past return time, not returned' },
  { key: 'manualReview', title: 'Manual Review', hint: 'Paid conflicts needing admin action' },
  { key: 'paidNotConfirmed', title: 'Paid — Not Confirmed', hint: 'Payment received, booking not confirmed' },
  { key: 'cancelled', title: 'Cancelled', hint: 'Recent cancellations' },
  { key: 'failedPayments', title: 'Failed / Expired Payments', hint: 'Holds and expired payment attempts' },
];
