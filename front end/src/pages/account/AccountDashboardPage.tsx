import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAccountDashboard } from '../../api/account';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';

function formatWhen(value?: string | null, time?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    const datePart = d.toLocaleDateString();
    return time ? `${datePart} ${time}` : datePart;
  } catch {
    return value;
  }
}

export function AccountDashboardPage() {
  const query = useQuery({
    queryKey: ['account', 'dashboard'],
    queryFn: getAccountDashboard,
  });

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-[var(--color-danger)]">Unable to load your account.</p>
      </div>
    );
  }

  const { counts, upcoming, recent } = query.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-accent-ink)]">My account</p>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-[var(--color-navy)]">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/account/reservations">
            <Button variant="outline" size="sm">
              My reservations
            </Button>
          </Link>
          <Link to="/account/documents">
            <Button size="sm">Documents</Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total bookings', value: counts.total },
          { label: 'Active', value: counts.active },
          { label: 'Completed', value: counts.completed },
        ].map((item) => (
          <Card key={item.label}>
            <CardBody>
              <p className="text-sm text-[var(--color-muted)]">{item.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-[var(--color-ink)]">
                {item.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {upcoming && (
        <Card className="mt-8">
          <CardBody>
            <h2 className="font-display text-lg font-semibold">Upcoming</h2>
            <p className="mt-2 text-[var(--color-ink)]">
              {upcoming.carName || 'Vehicle'} · {formatWhen(upcoming.pickupDate, upcoming.pickupTime)}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Status: {upcoming.status}</p>
            <Link to={`/account/reservations/${upcoming.id}`} className="mt-4 inline-block">
              <Button size="sm">View details</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Recent reservations</h2>
        {!recent.length ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No reservations yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    {r.carName || 'Vehicle'} · #{r.id}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {formatWhen(r.pickupDate, r.pickupTime)} · {r.status}
                  </p>
                </div>
                <Link to={`/account/reservations/${r.id}`}>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
