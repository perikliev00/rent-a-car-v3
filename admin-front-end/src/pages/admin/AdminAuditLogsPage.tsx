/**
 * Paginated audit trail with actor/entity filters.
 */
import { useState, Fragment } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminAuditLogs,
  // Declare the AuditActorType TypeScript type alias.
  type AuditActorType,
  // Declare the AuditLogRow TypeScript type alias.
  type AuditLogRow,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/auditLogs';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';

// Continue the surrounding logic with this statement.
const ACTION_LABELS: Record<string, string> = {
  // Supply the literal value used by the enclosing expression.
  'admin.created_car': 'Created car',
  // Supply the literal value used by the enclosing expression.
  'admin.updated_car': 'Updated car',
  // Supply the literal value used by the enclosing expression.
  'admin.updated_price': 'Updated price',
  // Supply the literal value used by the enclosing expression.
  'admin.changed_car_status': 'Changed car status',
  // Supply the literal value used by the enclosing expression.
  'admin.changed_car_fleet_status': 'Changed car fleet status',
  // Supply the literal value used by the enclosing expression.
  'admin.created_car_service_record': 'Created car service record',
  // Supply the literal value used by the enclosing expression.
  'admin.created_car_damage_report': 'Created car damage report',
  // Supply the literal value used by the enclosing expression.
  'admin.resolved_car_damage_report': 'Resolved car damage report',
  // Supply the literal value used by the enclosing expression.
  'admin.uploaded_car_document': 'Uploaded car document',
  // Supply the literal value used by the enclosing expression.
  'admin.created_car_compliance_item': 'Created car compliance item',
  // Supply the literal value used by the enclosing expression.
  'admin.updated_car_compliance_item': 'Updated car compliance item',
  // Supply the literal value used by the enclosing expression.
  'admin.deleted_car_compliance_item': 'Deleted car compliance item',
  // Supply the literal value used by the enclosing expression.
  'admin.created_reservation': 'Created reservation',
  // Supply the literal value used by the enclosing expression.
  'admin.updated_reservation': 'Updated reservation',
  // Supply the literal value used by the enclosing expression.
  'admin.moved_reservation': 'Moved reservation',
  // Supply the literal value used by the enclosing expression.
  'admin.cancelled_reservation': 'Cancelled reservation',
  // Supply the literal value used by the enclosing expression.
  'admin.restored_reservation': 'Restored reservation',
  // Supply the literal value used by the enclosing expression.
  'admin.emptied_deleted_orders': 'Emptied deleted orders',
  // Supply the literal value used by the enclosing expression.
  'admin.updated_contact_status': 'Updated contact status',
  // Supply the literal value used by the enclosing expression.
  'admin.deleted_contact': 'Deleted contact',
  // Supply the literal value used by the enclosing expression.
  'admin.ran_payment_reconcile': 'Ran payment reconcile',
  // Supply the literal value used by the enclosing expression.
  'system.confirmed_reservation_from_stripe': 'Confirmed reservation from Stripe',
  // Supply the literal value used by the enclosing expression.
  'system.paid_needs_manual_review': 'Paid needs manual review',
  // Supply the literal value used by the enclosing expression.
  'system.abandoned_reservations': 'Abandoned reservations',
  // Supply the literal value used by the enclosing expression.
  'system.reservation_status_changed': 'Reservation status changed',
  // Supply the literal value used by the enclosing expression.
  'admin.reservation_status_changed': 'Reservation status changed',
  // Supply the literal value used by the enclosing expression.
  'customer.reservation_status_changed': 'Reservation status changed',
  // Supply the literal value used by the enclosing expression.
  'customer.created_hold': 'Created hold',
  // Supply the literal value used by the enclosing expression.
  'customer.released_hold': 'Released hold',
  // Supply the literal value used by the enclosing expression.
  'customer.reheld': 'Re-held reservation',
  // Supply the literal value used by the enclosing expression.
  'customer.started_checkout': 'Started checkout',
  // Supply the literal value used by the enclosing expression.
  'customer.cancelled_checkout': 'Cancelled checkout',
};

/** Format Action Label. */
function formatActionLabel(action: string) {
  // Return the resulting value to the caller.
  return ACTION_LABELS[action] || action;
}

/** Format Actor. */
function formatActor(log: AuditLogRow) {
  // Evaluate the condition and enter the branch when it is true.
  if (log.actorType === 'system') return 'System';
  // Evaluate the condition and enter the branch when it is true.
  if (log.actorType === 'customer') {
    // Create the user id constant.
    const userId = log.metadata && typeof log.metadata === 'object' ? log.metadata.userId : null;
    // Evaluate the condition and enter the branch when it is true.
    if (userId != null) return `Customer #${String(userId)}`;
    // Return the resulting value to the caller.
    return 'Customer';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (log.adminUser?.email) return log.adminUser.email;
  // Evaluate the condition and enter the branch when it is true.
  if (log.adminUser?.id) return `Admin #${log.adminUser.id}`;
  // Return the resulting value to the caller.
  return 'Admin';
}

/** Format Entity. */
function formatEntity(log: AuditLogRow) {
  // Evaluate the condition and enter the branch when it is true.
  if (!log.entityId) return log.entityType;
  // Return the resulting value to the caller.
  return `${log.entityType} #${log.entityId}`;
}

/** Format Summary. */
function formatSummary(log: AuditLogRow) {
  // Evaluate the condition and enter the branch when it is true.
  if (!log.metadata || typeof log.metadata !== 'object') return '—';
  // Create the keys constant.
  const keys = Object.keys(log.metadata);
  // Evaluate the condition and enter the branch when it is true.
  if (keys.length === 0) return '—';
  // Return the resulting value to the caller.
  return keys
    // Call .slice to perform this step.
    .slice(0, 3)
    // Call .map to perform this step.
    .map((key) => `${key}: ${String((log.metadata as Record<string, unknown>)[key])}`)
    // Call .join to perform this step.
    .join(', ');
}

/** Format Time. */
function formatTime(value: string) {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return new Date(value).toLocaleString();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return value;
  }
}

/** Paginated audit trail with actor/entity filters. */
export function AdminAuditLogsPage() {
  // Destructure array values into local variables.
  const [filters, setFilters] = useState({
    // Provide the from field value.
    from: '',
    // Provide the to field value.
    to: '',
    // Provide the actor type field value.
    actorType: '' as AuditActorType | '',
    // Provide the action prefix field value.
    actionPrefix: '' as 'admin' | 'system' | 'customer' | '',
    // Provide the entity type field value.
    entityType: '',
    // Provide the entity id field value.
    entityId: '',
    // Provide the page field value.
    page: 1,
  });
  // Destructure array values into local variables.
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Destructure object properties into local variables.
  const { data, isLoading, isError, error } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'audit-logs', filters],
    // Provide the query fn field value.
    queryFn: () =>
      // Call getAdminAuditLogs to perform this step.
      getAdminAuditLogs({
        // Provide the page field value.
        page: filters.page,
        // Provide the limit field value.
        limit: 50,
        // Provide the from field value.
        from: filters.from || undefined,
        // Provide the to field value.
        to: filters.to || undefined,
        // Provide the actor type field value.
        actorType: filters.actorType || undefined,
        // Provide the action prefix field value.
        actionPrefix: filters.actionPrefix || undefined,
        // Provide the entity type field value.
        entityType: filters.entityType || undefined,
        // Provide the entity id field value.
        entityId: filters.entityId || undefined,
      }),
  });

  // Create the total constant.
  const total = data?.pagination.total ?? 0;
  // Create the limit constant.
  const limit = data?.pagination.limit ?? 50;
  // Create the total pages constant.
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Audit logs</h1>
        <p className="mt-1 text-[var(--color-muted)]">Admin and system action history</p>
      </div>

      <Card className="mt-6">
        <CardBody>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="From"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value, page: 1 })}
            />
            <Input
              label="To"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value, page: 1 })}
            />
            <Select
              label="Actor type"
              value={filters.actorType}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  actorType: e.target.value as AuditActorType | '',
                  page: 1,
                })
              }
              options={[
                { value: '', label: 'All' },
                { value: 'admin', label: 'Admin' },
                { value: 'system', label: 'System' },
                { value: 'customer', label: 'Customer' },
              ]}
            />
            <Select
              label="Category"
              value={filters.actionPrefix}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  actionPrefix: e.target.value as 'admin' | 'system' | 'customer' | '',
                  page: 1,
                })
              }
              options={[
                { value: '', label: 'All' },
                { value: 'admin', label: 'admin.*' },
                { value: 'system', label: 'system.*' },
                { value: 'customer', label: 'customer.*' },
              ]}
            />
            <Input
              label="Entity type"
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
              placeholder="car, order, reservation..."
            />
            <Input
              label="Entity ID"
              value={filters.entityId}
              onChange={(e) => setFilters({ ...filters, entityId: e.target.value, page: 1 })}
              placeholder="123"
            />
          </div>
        </CardBody>
      </Card>

      {isError && (
        <p className="mt-4 break-words text-sm text-red-600">
          {(error as Error)?.message || 'Failed to load audit logs.'}
        </p>
      )}

      <Card className="mt-6">
        <CardBody>
          <div className="min-w-0 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3 font-medium">Time</th>
                  <th className="pb-2 pr-3 font-medium">Actor</th>
                  <th className="pb-2 pr-3 font-medium">Action</th>
                  <th className="pb-2 pr-3 font-medium">Entity</th>
                  <th className="pb-2 pr-3 font-medium">Summary</th>
                  <th className="pb-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--color-muted)]">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  (data?.logs ?? []).map((log) => (
                    <Fragment key={log.id}>
                      <tr
                        className="cursor-pointer border-b border-[var(--color-line)] hover:bg-[var(--color-surface)]"
                        onClick={() =>
                          setExpandedId((current) => (current === log.id ? null : log.id))
                        }
                      >
                        <td className="py-3 pr-3 whitespace-nowrap text-[var(--color-ink)]">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="py-3 pr-3 break-words text-[var(--color-ink)]">{formatActor(log)}</td>
                        <td className="py-3 pr-3 text-[var(--color-ink)]">{formatActionLabel(log.action)}</td>
                        <td className="py-3 pr-3 text-[var(--color-ink)]">{formatEntity(log)}</td>
                        <td className="py-3 pr-3 max-w-xs truncate text-[var(--color-muted)]">
                          {formatSummary(log)}
                        </td>
                        <td className="py-3 text-[var(--color-muted)]">{log.ipAddress || '—'}</td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
                          <td colSpan={6} className="px-3 py-3">
                            <pre className="min-w-0 overflow-x-auto overscroll-x-contain rounded bg-white p-3 text-xs break-words whitespace-pre-wrap text-[var(--color-ink)]">
                              {JSON.stringify(log.metadata ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              Page {filters.page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
