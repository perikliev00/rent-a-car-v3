import type { Car, Order, OrderStatus } from '../../types/api';
import { api } from '../client';

export interface DashboardData {
  orders: Order[];
  stats: {
    totalOrders: number | null;
    totalRevenue: string | number | null;
    pendingOrders: number | null;
  };
}

export interface AdminOrderFilters {
  status?: OrderStatus | '';
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AdminCreateOrderBody {
  carId: string | number;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation: string;
  returnLocation: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  address: string;
  hotelName?: string;
  rentalDays?: number;
  deliveryPrice?: number;
  returnPrice?: number;
  totalPrice?: number;
}

export async function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>('/api/admin/dashboard');
}

export async function getAdminOrders(filters: AdminOrderFilters = {}): Promise<{
  orders: Order[];
  filters: { status: string; startDate: string; endDate: string; search: string };
}> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return api(`/api/admin/orders${qs ? `?${qs}` : ''}`);
}

export async function getExpiredOrders(): Promise<{ orders: Order[] }> {
  return api<{ orders: Order[] }>('/api/admin/orders/expired');
}

export async function getDeletedOrders(): Promise<{
  orders: Order[];
  retentionDays: number;
  emptyConfirmText: string;
}> {
  return api('/api/admin/orders/deleted');
}

export async function emptyDeletedOrders(confirmText: string): Promise<{ deletedCount: number }> {
  return api('/api/admin/orders/deleted/empty', {
    method: 'POST',
    body: JSON.stringify({ confirmText }),
  });
}

export async function getNewOrderForm(): Promise<{
  defaults: Record<string, unknown>;
  cars: Car[];
}> {
  return api('/api/admin/orders/new');
}

export async function createAdminOrder(body: AdminCreateOrderBody): Promise<{ created: boolean }> {
  return api('/api/admin/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getAdminOrder(id: string): Promise<{ order: Order }> {
  return api(`/api/admin/orders/${id}`);
}

export async function getAdminOrderEdit(id: string): Promise<{
  order: Order;
  cars: Car[];
  pickupDateISO: string;
  returnDateISO: string;
  pickupTimeHHMM: string;
  returnTimeHHMM: string;
}> {
  return api(`/api/admin/orders/${id}/edit`);
}

export async function updateAdminOrder(
  id: string,
  body: AdminCreateOrderBody,
): Promise<{ updated: boolean; id: number }> {
  return api(`/api/admin/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminOrder(id: string): Promise<{ deleted: boolean; id: number }> {
  return api(`/api/admin/orders/${id}`, { method: 'DELETE' });
}

export async function restoreAdminOrder(id: string): Promise<{ restored: boolean; id: number }> {
  return api(`/api/admin/orders/${id}/restore`, { method: 'POST' });
}
