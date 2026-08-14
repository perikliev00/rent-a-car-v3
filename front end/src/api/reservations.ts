import type { CreateOrderBody } from '../types/api';
import { api } from './client';

export async function releaseReservation(): Promise<{ released: true }> {
  return api<{ released: true }>('/api/reservations/release', { method: 'POST' });
}

export async function releaseAndRehold(body: CreateOrderBody): Promise<{ reheld: true }> {
  return api<{ reheld: true }>('/api/reservations/release-and-rehold', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
