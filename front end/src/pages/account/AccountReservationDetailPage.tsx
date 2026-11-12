/**
 * Single reservation detail for the signed-in customer: travel details, PDFs,
 * and cancellation request UI.
 */
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from 'react-router-dom'.
import { Link, useParams } from 'react-router-dom';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  downloadReservationPdf,
  // Contribute this line to the enclosing declaration or statement.
  getAccountReservation,
  // Contribute this line to the enclosing declaration or statement.
  requestCancellation,
  // Contribute this line to the enclosing declaration or statement.
  updateTravelDetails,
  // Declare the PdfKind TypeScript type alias.
  type PdfKind,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/account';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Textarea'.
import { Textarea } from '../../components/ui/Textarea';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';

/** Human labels for downloadable reservation PDF kinds. */
const PDF_LABELS: Record<PdfKind, string> = {
  // Provide the rental agreement field value.
  rental_agreement: 'Rental agreement',
  // Provide the invoice field value.
  invoice: 'Invoice',
  // Provide the receipt field value.
  receipt: 'Receipt',
  // Provide the damage report field value.
  damage_report: 'Damage report',
  // Provide the pickup checklist field value.
  pickup_checklist: 'Pickup checklist',
  // Provide the return checklist field value.
  return_checklist: 'Return checklist',
};

/**
 * Format a reservation date (and optional time) for detail rows.
 *
 * @param value - ISO date string or nullish.
 * @param time - Optional HH:MM time to append.
 * @returns Locale date string, optionally with time; `—` when missing.
 */
function formatWhen(value?: string | null, time?: string | null) {
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return '—';
  // Start a try block for operations that may fail.
  try {
    // Create the d constant.
    const d = new Date(value);
    // Return the resulting value to the caller.
    return time ? `${d.toLocaleDateString()} ${time}` : d.toLocaleDateString();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return value;
  }
}

/**
 * Account reservation detail page with travel edits, PDFs, and cancel request.
 *
 * @returns Detail UI for `/account/reservations/:id`, or a loader/error state.
 * @remarks Side effects: patches travel details, requests cancellation, downloads PDFs.
 */
export function AccountReservationDetailPage() {
  // Destructure object properties into local variables.
  const { id = '' } = useParams();
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the query constant.
  const query = useQuery({
    // Provide the query key field value.
    queryKey: ['account', 'reservations', id],
    // Provide the query fn field value.
    queryFn: () => getAccountReservation(id),
    // Provide the enabled field value.
    enabled: Boolean(id),
  });

  // Create the reservation constant.
  const reservation = query.data?.reservation;
  // Destructure array values into local variables.
  const [flightNumber, setFlightNumber] = useState('');
  // Destructure array values into local variables.
  const [hotelName, setHotelName] = useState('');
  // Destructure array values into local variables.
  const [address, setAddress] = useState('');
  // Destructure array values into local variables.
  const [specialRequests, setSpecialRequests] = useState('');
  // Destructure array values into local variables.
  const [cancelReason, setCancelReason] = useState('');

  // Seed editable travel fields whenever the reservation payload arrives/changes.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!reservation) return;
    // Call setFlightNumber to perform this step.
    setFlightNumber(reservation.flightNumber || '');
    // Call setHotelName to perform this step.
    setHotelName(reservation.hotelName || '');
    // Call setAddress to perform this step.
    setAddress(reservation.address || '');
    // Call setSpecialRequests to perform this step.
    setSpecialRequests(reservation.specialRequests || '');
  // Continue the surrounding logic with this statement.
  }, [reservation]);

  // Create the travel mutation constant.
  const travelMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call updateTravelDetails to perform this step.
      updateTravelDetails(id, { flightNumber, hotelName, address, specialRequests }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['account', 'reservations', id] });
      // Call toast to perform this step.
      toast('Travel details saved', 'success');
    },
    // Provide the on error field value.
    onError: (err) => {
      // Call toast to perform this step.
      toast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    },
  });

  // Create the cancel mutation constant.
  const cancelMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => requestCancellation(id, cancelReason),
    // Provide the on success field value.
    onSuccess: (data) => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['account'] });
      // Call toast to perform this step.
      toast(
        // Contribute this line to the enclosing declaration or statement.
        data.immediate
          // Contribute this line to the enclosing declaration or statement.
          ? 'Reservation cancelled'
          // Contribute this line to the enclosing declaration or statement.
          : 'Cancellation request submitted for review',
        // Supply the literal value used by the enclosing expression.
        'success',
      );
    },
    // Provide the on error field value.
    onError: (err) => {
      // Call toast to perform this step.
      toast(err instanceof ApiError ? err.message : 'Cancel failed', 'error');
    },
  });

  if (query.isLoading) return <PageLoader />;
  // Evaluate the condition and enter the branch when it is true.
  if (query.isError || !reservation) {
    // Return control to the caller with the following value.
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-[var(--color-danger)]">Reservation not found.</p>
        <Link to="/account/reservations" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Back
          </Button>
        </Link>
      </div>
    );
  }

  // Return control to the caller with the following value.
  return (
    <div className="mx-auto min-w-0 max-w-3xl overflow-x-clip px-4 py-10 sm:px-6">
      <Link to="/account/reservations" className="text-sm text-[var(--color-muted)] hover:underline">
        ← My reservations
      </Link>
      <h1 className="mt-3 break-words font-display text-3xl font-bold text-[var(--color-ink)]">
        Reservation #{reservation.id}
      </h1>
      <p className="mt-2 break-words text-[var(--color-muted)]">
        {reservation.carName || 'Vehicle'} · {reservation.status} · Payment:{' '}
        {reservation.paymentStatus}
      </p>

      <Card className="mt-8">
        <CardBody className="min-w-0 space-y-2 break-words text-sm">
          <p>
            <span className="font-medium">Pickup:</span>{' '}
            {formatWhen(reservation.pickupDate, reservation.pickupTime)} —{' '}
            {reservation.pickupLocation}
          </p>
          <p>
            <span className="font-medium">Return:</span>{' '}
            {formatWhen(reservation.returnDate, reservation.returnTime)} —{' '}
            {reservation.returnLocation}
          </p>
          <p>
            <span className="font-medium">Total:</span> EUR{' '}
            {Number(reservation.totalPrice).toFixed(2)}
          </p>
        </CardBody>
      </Card>

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-lg font-semibold">Pickup instructions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-muted)]">
          {(reservation.pickupInstructions || []).map((line) => (
            <li key={line} className="break-words">{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-lg font-semibold">Return instructions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-muted)]">
          {(reservation.returnInstructions || []).map((line) => (
            <li key={line} className="break-words">{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-lg font-semibold">Documents (PDF)</h2>
        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          {(reservation.availablePdfs || []).map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await downloadReservationPdf(id, kind);
                } catch {
                  toast('PDF download failed', 'error');
                }
              }}
            >
              {PDF_LABELS[kind] || kind}
            </Button>
          ))}
        </div>
      </section>

      <Card className="mt-8">
        <CardBody className="min-w-0 space-y-4">
          <h2 className="font-display text-lg font-semibold">Travel details</h2>
          <Input
            label="Flight number"
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value)}
          />
          <Input
            label="Hotel name"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
          />
          <Textarea
            label="Hotel / address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Textarea
            label="Special requests"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full sm:w-auto"
            loading={travelMutation.isPending}
            onClick={() => travelMutation.mutate()}
          >
            Save travel details
          </Button>
        </CardBody>
      </Card>

      {reservation.canRequestCancellation && (
        <Card className="mt-8">
          <CardBody className="min-w-0 space-y-4">
            <h2 className="font-display text-lg font-semibold">Cancellation</h2>
            {reservation.cancellationRequest?.status === 'pending' ? (
              <p className="text-sm text-[var(--color-muted)]">
                A cancellation request is pending admin review.
              </p>
            ) : (
              <>
                <Textarea
                  label="Reason (optional)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  Request cancellation
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
