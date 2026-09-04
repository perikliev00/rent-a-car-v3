import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getAnalyticsOverview,
  getCarsPerformance,
  getRevenueByCar,
  getRevenueByLocation,
  getUtilization,
} from '../../api/admin/analytics';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Loading';
import { formatPrice } from '../../utils/format';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function Kpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</p>
      <p className="font-display mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const { user } = useAuth();
  const canMoney = hasPermission(user, 'can_view_revenue');
  const initial = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const overviewQuery = useQuery({
    queryKey: ['admin', 'analytics', 'overview', from, to],
    queryFn: () => getAnalyticsOverview(from, to),
  });
  const byCarQuery = useQuery({
    queryKey: ['admin', 'analytics', 'by-car', from, to],
    queryFn: () => getRevenueByCar(from, to),
  });
  const byLocQuery = useQuery({
    queryKey: ['admin', 'analytics', 'by-loc', from, to],
    queryFn: () => getRevenueByLocation(from, to),
  });
  const utilQuery = useQuery({
    queryKey: ['admin', 'analytics', 'util', from, to],
    queryFn: () => getUtilization(from, to),
  });
  const perfQuery = useQuery({
    queryKey: ['admin', 'analytics', 'perf', from, to],
    queryFn: () => getCarsPerformance(from, to),
  });

  if (overviewQuery.isLoading) return <PageLoader />;

  const kpis = overviewQuery.data?.kpis;
  const chartData = (overviewQuery.data?.revenueSeries || []).map((r) => ({
    day: r.day.slice(5),
    revenue: r.revenue,
    bookings:
      overviewQuery.data?.bookingsSeries.find((b) => b.day === r.day)?.bookings ?? 0,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Analytics
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">Business KPIs and fleet performance</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[var(--color-muted)]">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)]">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {overviewQuery.isError && (
        <p className="mt-4 text-[var(--color-danger)]">
          {(overviewQuery.error as Error).message}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Revenue"
          value={canMoney && kpis?.monthlyRevenue != null ? formatPrice(kpis.monthlyRevenue) : '—'}
        />
        <Kpi label="Confirmed bookings" value={String(kpis?.weeklyBookings ?? 0)} />
        <Kpi label="Occupancy" value={pct(kpis?.occupancyRate ?? 0)} />
        <Kpi
          label="ADR"
          value={
            canMoney && kpis?.averageDailyRate != null ? formatPrice(kpis.averageDailyRate) : '—'
          }
        />
        <Kpi label="Cancelled" value={String(kpis?.cancelledBookings ?? 0)} />
        <Kpi
          label="Failed payments"
          value={`${kpis?.failedPayments.total ?? 0} (${kpis?.failedPayments.unresolved ?? 0} open)`}
        />
        <Kpi label="Conversion" value={pct(kpis?.conversionRate ?? 0)} />
        <Kpi label="Abandoned holds" value={String(kpis?.abandonedHolds ?? 0)} />
      </div>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Revenue & bookings</h2>
          <div className="mt-4 h-72 w-full">
            {chartData.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No series data for this range</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {canMoney && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="bookings"
                    stroke="var(--color-ink)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="font-semibold">Most rented cars</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[var(--color-muted)]">
                    <th className="pb-2 pr-3">Car</th>
                    <th className="pb-2 pr-3">Bookings</th>
                    <th className="pb-2">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewQuery.data?.mostRentedCars || []).map((c) => (
                    <tr key={c.carId} className="border-b border-[var(--color-line)]/60">
                      <td className="py-2 pr-3">
                        <Link className="underline-offset-2 hover:underline" to={`/admin/cars/${c.carId}`}>
                          {c.carName}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{c.bookingsCount}</td>
                      <td className="py-2">{c.rentedDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-semibold">Revenue by location</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[var(--color-muted)]">
                    <th className="pb-2 pr-3">Location</th>
                    <th className="pb-2 pr-3">Orders</th>
                    <th className="pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(byLocQuery.data?.rows || []).map((r) => (
                    <tr key={r.location} className="border-b border-[var(--color-line)]/60">
                      <td className="py-2 pr-3">{r.location}</td>
                      <td className="py-2 pr-3">{r.ordersCount}</td>
                      <td className="py-2">
                        {canMoney && r.revenue != null ? formatPrice(r.revenue) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Revenue by car</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Car</th>
                  <th className="pb-2 pr-3">Orders</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(byCarQuery.data?.rows || []).map((r) => (
                  <tr key={r.carId} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">
                      <Link className="underline-offset-2 hover:underline" to={`/admin/cars/${r.carId}`}>
                        {r.carName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{r.ordersCount}</td>
                    <td className="py-2">
                      {canMoney && r.revenue != null ? formatPrice(r.revenue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Utilization per vehicle</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Car</th>
                  <th className="pb-2 pr-3">Booked</th>
                  <th className="pb-2 pr-3">Maintenance</th>
                  <th className="pb-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {(utilQuery.data?.rows || []).map((r) => (
                  <tr key={r.carId} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">{r.carName}</td>
                    <td className="py-2 pr-3">{r.bookedDays}</td>
                    <td className="py-2 pr-3">{r.maintenanceDays}</td>
                    <td className="py-2">{pct(r.utilizationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Car performance</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Car</th>
                  <th className="pb-2 pr-3">Bookings</th>
                  <th className="pb-2 pr-3">Util.</th>
                  <th className="pb-2 pr-3">Maint. days</th>
                  <th className="pb-2 pr-3">Revenue</th>
                  <th className="pb-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {(perfQuery.data?.rows || []).map((r) => (
                  <tr key={r.carId} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">
                      <Link className="underline-offset-2 hover:underline" to={`/admin/cars/${r.carId}`}>
                        {r.carName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{r.bookingsCount}</td>
                    <td className="py-2 pr-3">{pct(r.utilizationRate)}</td>
                    <td className="py-2 pr-3">{r.maintenanceDays}</td>
                    <td className="py-2 pr-3">
                      {canMoney && r.revenue != null ? formatPrice(r.revenue) : '—'}
                    </td>
                    <td className="py-2">
                      {canMoney && r.profitability != null ? formatPrice(r.profitability) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
