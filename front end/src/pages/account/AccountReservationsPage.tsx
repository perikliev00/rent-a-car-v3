import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listAccountReservations } from '../../api/account';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Loading';
import { EmailUnverifiedBanner } from './EmailUnverifiedBanner';

function formatWhen(value?: string | null, time?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return time ? `${d.toLocaleDateString()} ${time}` : d.toLocaleDateString();
  } catch {
    return value;
  }
}

export function AccountReservationsPage() {
  const query = useQuery({
    queryKey: ['account', 'reservations'],
    queryFn: listAccountReservations,
  });

  if (query.isLoading) return <PageLoader />;

  const reservations = query.data?.reservations ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-accent-ink)]">My account</p>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-[var(--color-navy)]">
            My reservations
          </h1>
        </div>
        <Link to="/account">
          <Button variant="outline" size="sm">
            Dashboard
          </Button>
        </Link>
      </div>

      <EmailUnverifiedBanner />

      {query.isError ? (
        <p className="mt-6 text-[var(--color-danger)]">Unable to load reservations.</p>
      ) : !reservations.length ? (
        <p className="mt-8 text-[var(--color-muted)]">You have no reservations linked to this account.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {reservations.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <p className="font-medium text-[var(--color-ink)]">
                  {r.carName || 'Vehicle'} · Reservation #{r.id}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {formatWhen(r.pickupDate, r.pickupTime)} → {formatWhen(r.returnDate, r.returnTime)}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {r.status} · Payment: {r.paymentStatus} · EUR {Number(r.totalPrice).toFixed(2)}
                </p>
              </div>
              <Link to={`/account/reservations/${r.id}`}>
                <Button size="sm">Details</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
