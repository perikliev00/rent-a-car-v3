/**
 * Customer cancellation-request review (approve/deny).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/reservations';
// Import named exports from '../../../auth/usePermission'.
import { usePermission } from '../../../auth/usePermission';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Card'.
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';

// Create the refundable statuses constant.
const REFUNDABLE_STATUSES = new Set(['paid', 'manual_review', 'confirmed', 'car_prepared']);

/** Is Refundable Status. */
function isRefundableStatus(status: string | undefined): boolean {
  // Return the resulting value to the caller.
  return Boolean(status && REFUNDABLE_STATUSES.has(status));
}

/** Customer cancellation-request review (approve/deny). */
export function CancellationRequestsPanel({ onChanged }: { onChanged: () => void }) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the can refund payments constant.
  const canRefundPayments = usePermission('can_refund_payments');
  // Create the query constant.
  const query = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cancellation-requests'],
    // Provide the query fn field value.
    queryFn: listCancellationRequests,
  });

  // Create the review mutation constant.
  const reviewMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      // Call reviewCancellationRequest to perform this step.
      reviewCancellationRequest(id, { approve }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Cancellation request updated', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cancellation-requests'] });
      // Call onChanged to perform this step.
      onChanged();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message || 'Review failed', 'error'),
  });

  // Create the requests constant.
  const requests = query.data?.requests ?? [];
  // Evaluate the condition and enter the branch when it is true.
  if (query.isLoading) return null;

  // Create the needs finance hint constant.
  const needsFinanceHint = requests.some(
    // Continue the surrounding logic with this statement.
    (req) => isRefundableStatus(req.reservationStatus) && !canRefundPayments
  );

  // Return control to the caller with the following value.
  return (
    <Card className="mt-6 shadow-none">
      <CardBody className="px-5 py-4">
        <h2 className="font-display font-semibold text-[var(--color-ink)]">
          Cancellation requests
        </h2>
        <p className="text-sm text-[var(--color-muted)]">Pending customer cancellation requests</p>
        {needsFinanceHint ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Approving paid cancellations requires refund permission (finance).
          </p>
        ) : null}
        {!requests.length ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No pending requests</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((req) => {
              const approveBlocked =
                isRefundableStatus(req.reservationStatus) && !canRefundPayments;
              return (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)]/60 pb-3 last:border-0"
                >
                  <div className="min-w-0 text-sm">
                    <p className="break-words font-medium text-[var(--color-ink)]">
                      Reservation #{req.reservationId} · {req.customerName || req.customerEmail}
                    </p>
                    <p className="break-words text-[var(--color-muted)]">{req.reason || 'No reason provided'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={reviewMutation.isPending}
                      disabled={approveBlocked}
                      title={
                        approveBlocked
                          ? 'Refund permission is required to approve paid cancellations'
                          : undefined
                      }
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
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
