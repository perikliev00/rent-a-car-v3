/**
 * Admin audit-log listing with filter/pagination query builders.
 */
import { api } from '../client';

// Export the audit actor type type.
export type AuditActorType = 'admin' | 'system' | 'customer';

// Export the audit log admin user interface.
export interface AuditLogAdminUser {
  // Provide the id field value.
  id: number;
  // Provide the email field value.
  email: string | null;
}

// Export the audit log row interface.
export interface AuditLogRow {
  // Provide the id field value.
  id: number;
  // Provide the created at field value.
  createdAt: string;
  // Provide the action field value.
  action: string;
  // Provide the category field value.
  category: string | null;
  // Provide the actor type field value.
  actorType: AuditActorType;
  // Provide the admin user field value.
  adminUser: AuditLogAdminUser | null;
  // Provide the entity type field value.
  entityType: string;
  // Provide the entity id field value.
  entityId: string | null;
  // Provide the metadata field value.
  metadata: Record<string, unknown> | null;
  // Provide the ip address field value.
  ipAddress: string | null;
}

// Export the audit log pagination interface.
export interface AuditLogPagination {
  // Provide the page field value.
  page: number;
  // Provide the limit field value.
  limit: number;
  // Provide the total field value.
  total: number;
}

// Export the audit log filters interface.
export interface AuditLogFilters {
  // Contribute this line to the enclosing declaration or statement.
  page?: number;
  // Contribute this line to the enclosing declaration or statement.
  limit?: number;
  // Contribute this line to the enclosing declaration or statement.
  from?: string;
  // Contribute this line to the enclosing declaration or statement.
  to?: string;
  // Contribute this line to the enclosing declaration or statement.
  actorType?: AuditActorType | '';
  // Contribute this line to the enclosing declaration or statement.
  actionPrefix?: 'admin' | 'system' | 'customer' | '';
  // Contribute this line to the enclosing declaration or statement.
  action?: string;
  // Contribute this line to the enclosing declaration or statement.
  adminUserId?: string | number;
  // Contribute this line to the enclosing declaration or statement.
  entityType?: string;
  // Contribute this line to the enclosing declaration or statement.
  entityId?: string;
}

// Export the audit logs response interface.
export interface AuditLogsResponse {
  // Provide the logs field value.
  logs: AuditLogRow[];
  // Provide the pagination field value.
  pagination: AuditLogPagination;
}

/**
 * Fetch a page of audit logs with optional filters.
 * Empty / falsy filter fields are omitted so the API keeps its defaults.
 *
 * @param filters - Pagination and domain filters from the Audit Logs page
 */
export async function getAdminAuditLogs(
  // Provide the filters field value.
  filters: AuditLogFilters = {}
// Continue the surrounding logic with this statement.
): Promise<AuditLogsResponse> {
  // Build query string only from provided filters.
  const params = new URLSearchParams();
  // Pagination
  if (filters.page) params.set('page', String(filters.page));
  // Evaluate the condition and enter the branch when it is true.
  if (filters.limit) params.set('limit', String(filters.limit));
  // Date window
  if (filters.from) params.set('from', filters.from);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.to) params.set('to', filters.to);
  // Actor / action filters (skip empty strings from form selects)
  if (filters.actorType) params.set('actorType', filters.actorType);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.actionPrefix) params.set('actionPrefix', filters.actionPrefix);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.action) params.set('action', filters.action);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.adminUserId) params.set('adminUserId', String(filters.adminUserId));
  // Entity targeting
  if (filters.entityType) params.set('entityType', filters.entityType);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.entityId) params.set('entityId', filters.entityId);

  // Create the query constant.
  const query = params.toString();
  // Avoid a trailing `?` when no filters were set.
  return api<AuditLogsResponse>(`/api/admin/audit-logs${query ? `?${query}` : ''}`);
}
