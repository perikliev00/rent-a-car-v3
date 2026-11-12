/**
 * Outbound notification delivery log (email/etc.) for admin inspection.
 */
import { api } from '../client';

// Export the notification row type.
export type NotificationRow = {
  // Provide the id field value.
  id: string;
  // Provide the type field value.
  type: string;
  // Provide the channel field value.
  channel: string;
  // Provide the recipient email field value.
  recipientEmail: string | null;
  // Provide the reservation id field value.
  reservationId: string | null;
  // Provide the order id field value.
  orderId: string | null;
  // Provide the car id field value.
  carId: string | null;
  // Provide the status field value.
  status: string;
  // Provide the scheduled at field value.
  scheduledAt: string;
  // Provide the sent at field value.
  sentAt: string | null;
  // Provide the attempts field value.
  attempts: number;
  // Provide the last error field value.
  lastError: string | null;
  // Provide the created at field value.
  createdAt: string;
};

/**
 * Paginated notification delivery log with optional status filter.
 * Unset filters are omitted so the API applies its defaults.
 *
 * @param params.limit - Page size
 * @param params.offset - Row offset
 * @param params.status - Optional delivery status filter
 */
export async function getNotifications(params?: {
  // Contribute this line to the enclosing declaration or statement.
  limit?: number;
  // Contribute this line to the enclosing declaration or statement.
  offset?: number;
  // Contribute this line to the enclosing declaration or statement.
  status?: string;
// Continue the surrounding logic with this statement.
}): Promise<{ rows: NotificationRow[]; total: number; limit: number; offset: number }> {
  // Build query only from provided fields (`!= null` keeps limit/offset `0` valid).
  const q = new URLSearchParams();
  // Evaluate the condition and enter the branch when it is true.
  if (params?.limit != null) q.set('limit', String(params.limit));
  // Evaluate the condition and enter the branch when it is true.
  if (params?.offset != null) q.set('offset', String(params.offset));
  // Evaluate the condition and enter the branch when it is true.
  if (params?.status) q.set('status', params.status);
  // Create the qs constant.
  const qs = q.toString();
  // Return the resulting value to the caller.
  return api(`/api/admin/notifications${qs ? `?${qs}` : ''}`);
}
