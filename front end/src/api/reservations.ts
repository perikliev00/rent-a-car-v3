/**
 * Soft-hold lifecycle helpers used when the customer changes trip criteria
 * mid-booking. Holds expire server-side; these endpoints release or swap them
 * so another shopper can book the same car.
 */
import type { CreateOrderBody } from '../types/api';
// Import named exports from './client'.
import { api } from './client';

/**
 * Drop the current user's active car hold without creating a new one.
 *
 * @returns Confirmation that the hold was released.
 * @remarks Side effect: frees the car for other shoppers immediately.
 */
export async function releaseReservation(): Promise<{ released: true }> {
  // Return the resulting value to the caller.
  return api<{ released: true }>('/api/reservations/release', { method: 'POST' });
}

/**
 * Atomically release the current hold and place a new one for updated trip details.
 *
 * @param body - Updated trip/car criteria for the replacement hold.
 * @returns Confirmation that the re-hold succeeded.
 * @remarks Used when dates/locations change on the order page so the previous hold is not left dangling.
 */
export async function releaseAndRehold(body: CreateOrderBody): Promise<{ reheld: true }> {
  // Return the resulting value to the caller.
  return api<{ reheld: true }>('/api/reservations/release-and-rehold', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}
