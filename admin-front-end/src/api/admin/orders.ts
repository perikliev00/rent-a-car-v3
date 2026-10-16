/**
 * Admin order CRUD, soft-delete recycle bin, and dashboard summary APIs.
 */
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

/**
 * Dashboard summary: recent orders plus headline stats.
 */
export async function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>('/api/admin/dashboard');
}

/**
 * List orders with optional status/date/search filters.
 * Empty filter values are omitted from the query string.
 *
 * @param filters - Orders page filter state
 */
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

/**
 * Orders past their hold/expiry window (ops follow-up list).
 */
export async function getExpiredOrders(): Promise<{ orders: Order[] }> {
  return api<{ orders: Order[] }>('/api/admin/orders/expired');
}

/**
 * Soft-deleted orders plus retention metadata.
 * `emptyConfirmText` must be typed back to permanently purge the bin.
 */
export async function getDeletedOrders(): Promise<{
  orders: Order[];
  retentionDays: number;
  emptyConfirmText: string;
}> {
  return api('/api/admin/orders/deleted');
}

/**
 * Permanently empties the soft-delete bin after confirm-text match.
 * @param confirmText - Must equal the server-provided `emptyConfirmText`
 */
export async function emptyDeletedOrders(confirmText: string): Promise<{ deletedCount: number }> {
  return api('/api/admin/orders/deleted/empty', {
    method: 'POST',
    body: JSON.stringify({ confirmText }),
  });
}

/**
 * Bootstrap payload for the “create order” form (defaults + selectable cars).
 */
export async function getNewOrderForm(): Promise<{
  defaults: Record<string, unknown>;
  cars: Car[];
}> {
  return api('/api/admin/orders/new');
}

/**
 * Create an admin-entered order.
 * @param body - Customer, car, dates/locations, and optional price overrides
 */
export async function createAdminOrder(body: AdminCreateOrderBody): Promise<{ created: boolean }> {
  return api('/api/admin/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Load one order for the detail page.
 * @param id - Order id
 */
export async function getAdminOrder(id: string): Promise<{ order: Order }> {
  return api(`/api/admin/orders/${id}`);
}

/**
 * Load edit-form payload (order + cars + pre-normalized date/time strings).
 * @param id - Order id
 */
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

/**
 * Replace an order’s editable fields.
 * @param id - Order id
 * @param body - Full create-shaped payload used by the edit form
 */
export async function updateAdminOrder(
  id: string,
  body: AdminCreateOrderBody,
): Promise<{ updated: boolean; id: number }> {
  return api(`/api/admin/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Soft-delete an order (moves it to the recycle bin).
 * @param id - Order id
 */
export async function deleteAdminOrder(id: string): Promise<{ deleted: boolean; id: number }> {
  return api(`/api/admin/orders/${id}`, { method: 'DELETE' });
}

/**
 * Undoes a soft delete within the retention window.
 * @param id - Order id
 */
export async function restoreAdminOrder(id: string): Promise<{ restored: boolean; id: number }> {
  return api(`/api/admin/orders/${id}/restore`, { method: 'POST' });
}
