/**
 * Widget metadata (titles/keys) for the ops dashboard buckets.
 */
import type { OpsReservationRow } from '../../../api/admin/reservations';

/**
 * Empty widget bucket map used as a loading/error fallback.
 */
export function emptyWidgets() {
  // Return the resulting value to the caller.
  return {
    // Provide the todays pickups field value.
    todaysPickups: [] as OpsReservationRow[],
    // Provide the todays returns field value.
    todaysReturns: [] as OpsReservationRow[],
    // Provide the active rentals field value.
    activeRentals: [] as OpsReservationRow[],
    // Provide the overdue returns field value.
    overdueReturns: [] as OpsReservationRow[],
    // Provide the manual review field value.
    manualReview: [] as OpsReservationRow[],
    // Provide the paid not confirmed field value.
    paidNotConfirmed: [] as OpsReservationRow[],
    // Provide the cancelled field value.
    cancelled: [] as OpsReservationRow[],
    // Provide the failed payments field value.
    failedPayments: [] as OpsReservationRow[],
  };
}

/** Titles/hints rendered above each ops dashboard widget table. */
export const WIDGET_META: { key: keyof ReturnType<typeof emptyWidgets>; title: string; hint: string }[] = [
  // Contribute this line to the enclosing declaration or statement.
  { key: 'todaysPickups', title: "Today's Pickups", hint: 'Confirmed / prepared for pickup today' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'todaysReturns', title: "Today's Returns", hint: 'Out on rental, due back today' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'activeRentals', title: 'Active Rentals', hint: 'Picked up or active rental' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'overdueReturns', title: 'Overdue Returns', hint: 'Past return time, not returned' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'manualReview', title: 'Manual Review', hint: 'Paid conflicts needing admin action' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'paidNotConfirmed', title: 'Paid — Not Confirmed', hint: 'Payment received, booking not confirmed' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'cancelled', title: 'Cancelled', hint: 'Recent cancellations' },
  // Contribute this line to the enclosing declaration or statement.
  { key: 'failedPayments', title: 'Failed / Expired Payments', hint: 'Holds and expired payment attempts' },
];
