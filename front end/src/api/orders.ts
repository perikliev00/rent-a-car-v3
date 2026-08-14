import type { CreateOrderBody, OrderPageData } from '../types/api';
import { api } from './client';

export async function createOrder(body: CreateOrderBody): Promise<OrderPageData> {
  return api<OrderPageData>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
