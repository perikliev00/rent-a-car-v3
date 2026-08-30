import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCancellationRequests,
  reviewCancellationRequest,
} from '../../../api/admin/reservations';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { toast } from '../../../components/ui/toastStore';

export function CancellationRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'cancellation-requests'],
    queryFn: listCancellationRequests,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      reviewCancellationRequest(id, { approve }),
    onSuccess: () => {
      toast('Cancellation request updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cancellation-requests'] });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Review failed', 'error'),
  });

  const requests = query.data?.requests ?? [];
  if (query.isLoading) return null;

  return (
    <Card className="mt-6 shadow-none">
      <CardBody className="px-5 py-4">
        <h2 className="font-display font-semibold text-[var(--color-ink)]">
          Cancellation requests
        </h2>
        <p className="text-sm text-[var(--color-muted)]">Pending customer cancellation requests</p>
        {!requests.length ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No pending requests</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)]/60 pb-3 last:border-0"
              >
                <div className="text-sm">
                  <p className="font-medium text-[var(--color-ink)]">
                    Reservation #{req.reservationId} · {req.customerName || req.customerEmail}
                  </p>
                  <p className="text-[var(--color-muted)]">{req.reason || 'No reason provided'}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: req.id, approve: true })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: req.id, approve: false })}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
