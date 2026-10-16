/**
 * Order creation for the booking hold step.
 * Creating an order places a short-lived hold on the car before checkout.
 */
import type { CreateOrderBody, OrderPageData } from '../types/api';
import { api } from './client';

/**
 * Create (or refresh) a pending order with a car hold.
 *
 * @param body - Selected car, trip criteria, extras, and customer fields for the hold.
 * @returns Order page payload used to render the pre-checkout summary.
 * @remarks Side effect: places (or refreshes) a short-lived soft-hold on the car server-side.
 */
export async function createOrder(body: CreateOrderBody): Promise<OrderPageData> {
  return api<OrderPageData>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
