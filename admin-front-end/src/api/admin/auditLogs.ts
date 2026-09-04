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

export async function getAdminAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.actorType) params.set('actorType', filters.actorType);
  if (filters.actionPrefix) params.set('actionPrefix', filters.actionPrefix);
  if (filters.action) params.set('action', filters.action);
  if (filters.adminUserId) params.set('adminUserId', String(filters.adminUserId));
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);

  const query = params.toString();
  return api<AuditLogsResponse>(`/api/admin/audit-logs${query ? `?${query}` : ''}`);
}
