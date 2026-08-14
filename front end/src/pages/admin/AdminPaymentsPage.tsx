import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayments, reconcilePayments } from '../../api/admin/payments';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const canRefund = hasPermission(user, 'can_refund_payments');
  const queryClient = useQueryClient();
  const [dryRun, setDryRun] = useState(true);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'payments'], queryFn: getPayments });

  const reconcileMutation = useMutation({
    mutationFn: () => reconcilePayments(dryRun),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast(`Reconcile ${result.dryRun ? '(dry run) ' : ''}completed`, 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Payments</h1>
          <p className="mt-1 text-[var(--color-muted)]">
            {data?.unresolvedFailureCount ?? 0} unresolved failure(s)
          </p>
        </div>
        {canRefund ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              Dry run
            </label>
            <Button loading={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate()}>
              Reconcile
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Recent events</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Session</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {data?.events.slice(0, 20).map((ev) => (
                  <tr key={ev.id} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">{ev.event_type}</td>
                    <td className="py-2 pr-3">{ev.status}</td>
                    <td className="py-2 pr-3 font-mono">{ev.stripe_session_id?.slice(0, 16) ?? '—'}…</td>
                    <td className="py-2">{new Date(ev.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <h2 className="font-semibold text-[var(--color-danger)]">Failures</h2>
          <div className="mt-4 space-y-3">
            {data?.failures.map((f) => (
              <div key={f.id} className="rounded-lg border border-[var(--color-danger)]/20 bg-red-50 p-3 text-sm">
                <p className="font-medium">{f.reason}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {f.resolved ? 'Resolved' : 'Unresolved'} · {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {data?.failures.length === 0 && <p className="text-[var(--color-muted)]">No failures recorded</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
