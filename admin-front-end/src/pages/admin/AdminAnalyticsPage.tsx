/**
 * Revenue/utilization analytics for a selected date range.
 */
import { useMemo, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  CartesianGrid,
  // Contribute this line to the enclosing declaration or statement.
  Line,
  // Contribute this line to the enclosing declaration or statement.
  LineChart,
  // Contribute this line to the enclosing declaration or statement.
  ResponsiveContainer,
  // Contribute this line to the enclosing declaration or statement.
  Tooltip,
  // Contribute this line to the enclosing declaration or statement.
  XAxis,
  // Contribute this line to the enclosing declaration or statement.
  YAxis,
// Contribute this line to the enclosing declaration or statement.
} from 'recharts';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAnalyticsOverview,
  // Contribute this line to the enclosing declaration or statement.
  getCarsPerformance,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByCar,
  // Contribute this line to the enclosing declaration or statement.
  getRevenueByLocation,
  // Contribute this line to the enclosing declaration or statement.
  getUtilization,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/analytics';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../utils/format'.
import { formatPrice } from '../../utils/format';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../auth/permissions'.
import { hasPermission } from '../../auth/permissions';

/** Default Range. */
function defaultRange() {
  // Create the to constant.
  const to = new Date();
  // Create the from constant.
  const from = new Date();
  // Call from.setDate to perform this step.
  from.setDate(to.getDate() - 29);
  // Create the fmt constant.
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  // Return the resulting value to the caller.
  return { from: fmt(from), to: fmt(to) };
}

/** Pct. */
function pct(rate: number) {
  // Return the resulting value to the caller.
  return `${(rate * 100).toFixed(1)}%`;
}

/** Kpi. */
function Kpi({
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  value,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the label field value.
  label: string;
  // Provide the value field value.
  value: string;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</p>
      <p className="font-display mt-2 break-words text-2xl font-bold tracking-tight text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}

/** Revenue/utilization analytics for a selected date range. */
export function AdminAnalyticsPage() {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can money constant.
  const canMoney = hasPermission(user, 'can_view_revenue');
  // Create the initial constant.
  const initial = useMemo(() => defaultRange(), []);
  // Destructure array values into local variables.
  const [from, setFrom] = useState(initial.from);
  // Destructure array values into local variables.
  const [to, setTo] = useState(initial.to);

  // Create the overview query constant.
  const overviewQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'analytics', 'overview', from, to],
    // Provide the query fn field value.
    queryFn: () => getAnalyticsOverview(from, to),
  });
  // Create the by car query constant.
  const byCarQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'analytics', 'by-car', from, to],
    // Provide the query fn field value.
    queryFn: () => getRevenueByCar(from, to),
  });
  // Create the by loc query constant.
  const byLocQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'analytics', 'by-loc', from, to],
    // Provide the query fn field value.
    queryFn: () => getRevenueByLocation(from, to),
  });
  // Create the util query constant.
  const utilQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'analytics', 'util', from, to],
    // Provide the query fn field value.
    queryFn: () => getUtilization(from, to),
  });
  // Create the perf query constant.
  const perfQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'analytics', 'perf', from, to],
    // Provide the query fn field value.
    queryFn: () => getCarsPerformance(from, to),
  });

  if (overviewQuery.isLoading) return <PageLoader />;

  // Create the kpis constant.
  const kpis = overviewQuery.data?.kpis;
  // Create the chart data constant.
  const chartData = (overviewQuery.data?.revenueSeries || []).map((r) => ({
    // Provide the day field value.
    day: r.day.slice(5),
    // Provide the revenue field value.
    revenue: r.revenue,
    // Provide the bookings field value.
    bookings:
      // Continue the surrounding logic with this statement.
      overviewQuery.data?.bookingsSeries.find((b) => b.day === r.day)?.bookings ?? 0,
  }));

  // Return control to the caller with the following value.
  return (
    <div>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">Business KPIs and fleet performance</p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <div className="min-w-0">
            <label className="block text-xs text-[var(--color-muted)]">From</label>
            <Input type="date" className="min-w-0" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-[var(--color-muted)]">To</label>
            <Input type="date" className="min-w-0" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {overviewQuery.isError && (
        <p className="mt-4 text-[var(--color-danger)]">
          {(overviewQuery.error as Error).message}
        </p>
      )}

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="mt-4 h-72 w-full min-w-0">
            {chartData.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No series data for this range</p>
            ) : (
              <div className="h-full w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={32} />
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
              </div>
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
