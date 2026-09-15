import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  downloadReservationPdf,
  getAccountReservation,
  requestCancellation,
  updateTravelDetails,
  type PdfKind,
} from '../../api/account';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Loading';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from '../../components/ui/toastStore';
import { ApiError } from '../../api/client';

const PDF_LABELS: Record<PdfKind, string> = {
  rental_agreement: 'Rental agreement',
  invoice: 'Invoice',
  receipt: 'Receipt',
  damage_report: 'Damage report',
  pickup_checklist: 'Pickup checklist',
  return_checklist: 'Return checklist',
};

function formatWhen(value?: string | null, time?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return time ? `${d.toLocaleDateString()} ${time}` : d.toLocaleDateString();
  } catch {
    return value;
  }
}

export function AccountReservationDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['account', 'reservations', id],
    queryFn: () => getAccountReservation(id),
    enabled: Boolean(id),
  });

  const reservation = query.data?.reservation;
  const [flightNumber, setFlightNumber] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [address, setAddress] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!reservation) return;
    setFlightNumber(reservation.flightNumber || '');
    setHotelName(reservation.hotelName || '');
    setAddress(reservation.address || '');
    setSpecialRequests(reservation.specialRequests || '');
  }, [reservation]);

  const travelMutation = useMutation({
    mutationFn: () =>
      updateTravelDetails(id, { flightNumber, hotelName, address, specialRequests }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'reservations', id] });
      toast('Travel details saved', 'success');
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => requestCancellation(id, cancelReason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
      toast(
        data.immediate
          ? 'Reservation cancelled'
          : 'Cancellation request submitted for review',
        'success',
      );
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : 'Cancel failed', 'error');
    },
  });

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !reservation) {
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
