/**
 * Admin order CRUD, soft-delete recycle bin, and dashboard summary APIs.
 */
import type { Car, Order, OrderStatus } from '../../types/api';
// Import named exports from '../client'.
import { api } from '../client';

// Export the dashboard data interface.
export interface DashboardData {
  // Provide the orders field value.
  orders: Order[];
  // Provide the stats field value.
  stats: {
    // Provide the total orders field value.
    totalOrders: number | null;
    // Provide the total revenue field value.
    totalRevenue: string | number | null;
    // Provide the pending orders field value.
    pendingOrders: number | null;
  };
}

// Export the admin order filters interface.
export interface AdminOrderFilters {
  // Contribute this line to the enclosing declaration or statement.
  status?: OrderStatus | '';
  // Contribute this line to the enclosing declaration or statement.
  startDate?: string;
  // Contribute this line to the enclosing declaration or statement.
  endDate?: string;
  // Contribute this line to the enclosing declaration or statement.
  search?: string;
}

// Export the admin create order body interface.
export interface AdminCreateOrderBody {
  // Provide the car id field value.
  carId: string | number;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Provide the pickup location field value.
  pickupLocation: string;
  // Provide the return location field value.
  returnLocation: string;
  // Provide the full name field value.
  fullName: string;
  // Provide the phone number field value.
  phoneNumber: string;
  // Provide the email field value.
  email: string;
  // Provide the address field value.
  address: string;
  // Contribute this line to the enclosing declaration or statement.
  hotelName?: string;
  // Contribute this line to the enclosing declaration or statement.
  rentalDays?: number;
  // Contribute this line to the enclosing declaration or statement.
  deliveryPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  returnPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  totalPrice?: number;
}

/**
 * Dashboard summary: recent orders plus headline stats.
 */
export async function getDashboard(): Promise<DashboardData> {
  // Return the resulting value to the caller.
  return api<DashboardData>('/api/admin/dashboard');
}

/**
 * List orders with optional status/date/search filters.
 * Empty filter values are omitted from the query string.
 *
 * @param filters - Orders page filter state
 */
export async function getAdminOrders(filters: AdminOrderFilters = {}): Promise<{
  // Provide the orders field value.
  orders: Order[];
  // Provide the filters field value.
  filters: { status: string; startDate: string; endDate: string; search: string };
// Continue the surrounding logic with this statement.
}> {
  // Create the params constant.
  const params = new URLSearchParams();
  // Evaluate the condition and enter the branch when it is true.
  if (filters.status) params.set('status', filters.status);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.startDate) params.set('startDate', filters.startDate);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.endDate) params.set('endDate', filters.endDate);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.search) params.set('search', filters.search);
  // Create the qs constant.
  const qs = params.toString();
  // Return the resulting value to the caller.
  return api(`/api/admin/orders${qs ? `?${qs}` : ''}`);
}

/**
 * Orders past their hold/expiry window (ops follow-up list).
 */
export async function getExpiredOrders(): Promise<{ orders: Order[] }> {
  // Return the resulting value to the caller.
  return api<{ orders: Order[] }>('/api/admin/orders/expired');
}

/**
 * Soft-deleted orders plus retention metadata.
 * `emptyConfirmText` must be typed back to permanently purge the bin.
 */
export async function getDeletedOrders(): Promise<{
  // Provide the orders field value.
  orders: Order[];
  // Provide the retention days field value.
  retentionDays: number;
  // Provide the empty confirm text field value.
  emptyConfirmText: string;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/orders/deleted');
}

/**
 * Permanently empties the soft-delete bin after confirm-text match.
 * @param confirmText - Must equal the server-provided `emptyConfirmText`
 */
export async function emptyDeletedOrders(confirmText: string): Promise<{ deletedCount: number }> {
  // Return the resulting value to the caller.
  return api('/api/admin/orders/deleted/empty', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify({ confirmText }),
  });
}

/**
 * Bootstrap payload for the “create order” form (defaults + selectable cars).
 */
export async function getNewOrderForm(): Promise<{
  // Provide the defaults field value.
  defaults: Record<string, unknown>;
  // Provide the cars field value.
  cars: Car[];
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/orders/new');
}

/**
 * Create an admin-entered order.
 * @param body - Customer, car, dates/locations, and optional price overrides
 */
export async function createAdminOrder(body: AdminCreateOrderBody): Promise<{ created: boolean }> {
  // Return the resulting value to the caller.
  return api('/api/admin/orders', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Load one order for the detail page.
 * @param id - Order id
 */
export async function getAdminOrder(id: string): Promise<{ order: Order }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/orders/${id}`);
}

/**
 * Load edit-form payload (order + cars + pre-normalized date/time strings).
 * @param id - Order id
 */
export async function getAdminOrderEdit(id: string): Promise<{
  // Provide the order field value.
  order: Order;
  // Provide the cars field value.
  cars: Car[];
  // Provide the pickup date iso field value.
  pickupDateISO: string;
  // Provide the return date iso field value.
  returnDateISO: string;
  // Provide the pickup time hhmm field value.
  pickupTimeHHMM: string;
  // Provide the return time hhmm field value.
  returnTimeHHMM: string;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api(`/api/admin/orders/${id}/edit`);
}

/**
 * Replace an order’s editable fields.
 * @param id - Order id
 * @param body - Full create-shaped payload used by the edit form
 */
export async function updateAdminOrder(
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: AdminCreateOrderBody,
// Continue the surrounding logic with this statement.
): Promise<{ updated: boolean; id: number }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/orders/${id}`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Soft-delete an order (moves it to the recycle bin).
 * @param id - Order id
 */
export async function deleteAdminOrder(id: string): Promise<{ deleted: boolean; id: number }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/orders/${id}`, { method: 'DELETE' });
}

/**
 * Undoes a soft delete within the retention window.
 * @param id - Order id
 */
export async function restoreAdminOrder(id: string): Promise<{ restored: boolean; id: number }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/orders/${id}/restore`, { method: 'POST' });
}
