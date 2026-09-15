import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../../api/admin/notifications';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { Select } from '../../components/ui/Select';

function statusClass(status: string) {
  if (status === 'sent') return 'text-[var(--color-success)]';
  if (status === 'failed') return 'text-[var(--color-danger)]';
  if (status === 'pending' || status === 'processing') return 'text-[var(--color-ink)]';
  return 'text-[var(--color-muted)]';
}

export function AdminNotificationsPage() {
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'notifications', status],
    queryFn: () =>
      getNotifications({
        limit: 50,
        status: status || undefined,
      }),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            {data?.total ?? 0} notification(s) in log
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-48">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'sent', label: 'Sent' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      {isError && (
        <p className="mt-4 text-[var(--color-danger)]">{(error as Error).message}</p>
      )}

      <Card className="mt-8">
        <CardBody>
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Recipient</th>
                  <th className="pb-2 pr-3">Scheduled</th>
                  <th className="pb-2 pr-3">Sent</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((n) => (
                  <tr key={n.id} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3 font-mono">{n.type}</td>
                    <td className={`py-2 pr-3 font-medium ${statusClass(n.status)}`}>{n.status}</td>
                    <td className="py-2 pr-3">{n.recipientEmail || '—'}</td>
                    <td className="py-2 pr-3">
                      {n.scheduledAt ? new Date(n.scheduledAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {n.sentAt ? new Date(n.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 text-[var(--color-danger)]">
                      {n.lastError ? n.lastError.slice(0, 80) : '—'}
                    </td>
                  </tr>
                ))}
                {!data?.rows?.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-[var(--color-muted)]">
                      No notifications yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
