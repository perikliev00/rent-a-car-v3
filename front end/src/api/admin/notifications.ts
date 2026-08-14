import { api } from '../client';

export type NotificationRow = {
  id: string;
  type: string;
  channel: string;
  recipientEmail: string | null;
  reservationId: string | null;
  orderId: string | null;
  carId: string | null;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<{ rows: NotificationRow[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  return api(`/api/admin/notifications${qs ? `?${qs}` : ''}`);
}
