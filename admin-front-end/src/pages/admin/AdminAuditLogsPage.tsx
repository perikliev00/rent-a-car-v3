import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getAdminAuditLogs,
  type AuditActorType,
  type AuditLogRow,
} from '../../api/admin/auditLogs';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';

const ACTION_LABELS: Record<string, string> = {
  'admin.created_car': 'Created car',
  'admin.updated_car': 'Updated car',
  'admin.updated_price': 'Updated price',
  'admin.changed_car_status': 'Changed car status',
  'admin.changed_car_fleet_status': 'Changed car fleet status',
  'admin.created_car_service_record': 'Created car service record',
  'admin.created_car_damage_report': 'Created car damage report',
  'admin.resolved_car_damage_report': 'Resolved car damage report',
  'admin.uploaded_car_document': 'Uploaded car document',
  'admin.created_car_compliance_item': 'Created car compliance item',
  'admin.updated_car_compliance_item': 'Updated car compliance item',
  'admin.deleted_car_compliance_item': 'Deleted car compliance item',
  'admin.created_reservation': 'Created reservation',
  'admin.updated_reservation': 'Updated reservation',
  'admin.moved_reservation': 'Moved reservation',
  'admin.cancelled_reservation': 'Cancelled reservation',
  'admin.restored_reservation': 'Restored reservation',
  'admin.emptied_deleted_orders': 'Emptied deleted orders',
  'admin.updated_contact_status': 'Updated contact status',
  'admin.deleted_contact': 'Deleted contact',
  'admin.ran_payment_reconcile': 'Ran payment reconcile',
  'system.confirmed_reservation_from_stripe': 'Confirmed reservation from Stripe',
  'system.paid_needs_manual_review': 'Paid needs manual review',
  'system.abandoned_reservations': 'Abandoned reservations',
  'system.reservation_status_changed': 'Reservation status changed',
  'admin.reservation_status_changed': 'Reservation status changed',
  'customer.reservation_status_changed': 'Reservation status changed',
  'customer.created_hold': 'Created hold',
  'customer.released_hold': 'Released hold',
  'customer.reheld': 'Re-held reservation',
  'customer.started_checkout': 'Started checkout',
  'customer.cancelled_checkout': 'Cancelled checkout',
};

function formatActionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

function formatActor(log: AuditLogRow) {
  if (log.actorType === 'system') return 'System';
  if (log.actorType === 'customer') {
    const userId = log.metadata && typeof log.metadata === 'object' ? log.metadata.userId : null;
    if (userId != null) return `Customer #${String(userId)}`;
    return 'Customer';
  }
  if (log.adminUser?.email) return log.adminUser.email;
  if (log.adminUser?.id) return `Admin #${log.adminUser.id}`;
  return 'Admin';
}

function formatEntity(log: AuditLogRow) {
  if (!log.entityId) return log.entityType;
  return `${log.entityType} #${log.entityId}`;
}

function formatSummary(log: AuditLogRow) {
  if (!log.metadata || typeof log.metadata !== 'object') return '—';
  const keys = Object.keys(log.metadata);
  if (keys.length === 0) return '—';
  return keys
    .slice(0, 3)
    .map((key) => `${key}: ${String((log.metadata as Record<string, unknown>)[key])}`)
    .join(', ');
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    actorType: '' as AuditActorType | '',
    actionPrefix: '' as 'admin' | 'system' | 'customer' | '',
    entityType: '',
    entityId: '',
    page: 1,
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () =>
      getAdminAuditLogs({
        page: filters.page,
        limit: 50,
        from: filters.from || undefined,
        to: filters.to || undefined,
        actorType: filters.actorType || undefined,
        actionPrefix: filters.actionPrefix || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
      }),
  });

  const total = data?.pagination.total ?? 0;
  const limit = data?.pagination.limit ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Audit logs</h1>
        <p className="mt-1 text-[var(--color-muted)]">Admin and system action history</p>
      </div>

      <Card className="mt-6">
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <p className="mt-4 text-sm text-red-600">
          {(error as Error)?.message || 'Failed to load audit logs.'}
        </p>
      )}

      <Card className="mt-6">
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
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
                        <td className="py-3 pr-3 text-[var(--color-ink)]">{formatActor(log)}</td>
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
                            <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-[var(--color-ink)]">
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
