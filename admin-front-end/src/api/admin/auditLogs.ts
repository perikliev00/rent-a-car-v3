/**
 * Admin audit-log listing with filter/pagination query builders.
 */
import { api } from '../client';

export type AuditActorType = 'admin' | 'system' | 'customer';

export interface AuditLogAdminUser {
  id: number;
  email: string | null;
}

export interface AuditLogRow {
  id: number;
  createdAt: string;
  action: string;
  category: string | null;
  actorType: AuditActorType;
  adminUser: AuditLogAdminUser | null;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  actorType?: AuditActorType | '';
  actionPrefix?: 'admin' | 'system' | 'customer' | '';
  action?: string;
  adminUserId?: string | number;
  entityType?: string;
  entityId?: string;
}

export interface AuditLogsResponse {
  logs: AuditLogRow[];
  pagination: AuditLogPagination;
}

/**
 * Fetch a page of audit logs with optional filters.
 * Empty / falsy filter fields are omitted so the API keeps its defaults.
 *
 * @param filters - Pagination and domain filters from the Audit Logs page
 */
export async function getAdminAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogsResponse> {
  // Build query string only from provided filters.
  const params = new URLSearchParams();
  // Pagination
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  // Date window
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  // Actor / action filters (skip empty strings from form selects)
  if (filters.actorType) params.set('actorType', filters.actorType);
  if (filters.actionPrefix) params.set('actionPrefix', filters.actionPrefix);
  if (filters.action) params.set('action', filters.action);
  if (filters.adminUserId) params.set('adminUserId', String(filters.adminUserId));
  // Entity targeting
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);

  const query = params.toString();
  // Avoid a trailing `?` when no filters were set.
  return api<AuditLogsResponse>(`/api/admin/audit-logs${query ? `?${query}` : ''}`);
}
