/**
 * Per-car analytics performance panel.
 */
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../utils/format'.
import { formatPrice } from '../../../utils/format';

// Declare the PerfCar TypeScript type alias.
type PerfCar = {
  // Contribute this line to the enclosing declaration or statement.
  revenue?: number | null;
  // Provide the bookings count field value.
  bookingsCount: number;
  // Provide the utilization rate field value.
  utilizationRate: number;
  // Provide the maintenance days field value.
  maintenanceDays: number;
  // Contribute this line to the enclosing declaration or statement.
  repairCost?: number | null;
  // Contribute this line to the enclosing declaration or statement.
  serviceCost?: number | null;
  // Contribute this line to the enclosing declaration or statement.
  profitability?: number | null;
};

/** Per-car analytics performance panel. */
export function CarPerformanceTab({
  // Contribute this line to the enclosing declaration or statement.
  canMoney,
  // Contribute this line to the enclosing declaration or statement.
  perfRange,
  // Contribute this line to the enclosing declaration or statement.
  setPerfRange,
  // Contribute this line to the enclosing declaration or statement.
  perfLoading,
  // Contribute this line to the enclosing declaration or statement.
  perfError,
  // Contribute this line to the enclosing declaration or statement.
  perfCar,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the can money field value.
  canMoney: boolean;
  // Provide the perf range field value.
  perfRange: { from: string; to: string };
  // Provide the set perf range field value.
  setPerfRange: (v: { from: string; to: string }) => void;
  // Provide the perf loading field value.
  perfLoading: boolean;
  // Provide the perf error field value.
  perfError: Error | null;
  // Provide the perf car field value.
  perfCar: PerfCar | null | undefined;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-[var(--color-muted)]">From</label>
              <Input
                type="date"
                value={perfRange.from}
                onChange={(e) => setPerfRange({ ...perfRange, from: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-muted)]">To</label>
              <Input
                type="date"
                value={perfRange.to}
                onChange={(e) => setPerfRange({ ...perfRange, to: e.target.value })}
              />
            </div>
          </div>
          {perfLoading ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : perfError ? (
            <p className="mt-4 break-words text-sm text-[var(--color-danger)]">{perfError.message}</p>
          ) : perfCar ? (
            <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: 'Revenue',
                  value:
                    canMoney && perfCar.revenue != null ? formatPrice(perfCar.revenue) : '—',
                },
                {
                  label: 'Bookings',
                  value: String(perfCar.bookingsCount),
                },
                {
                  label: 'Utilization',
                  value: `${(perfCar.utilizationRate * 100).toFixed(1)}%`,
                },
                {
                  label: 'Maintenance days',
                  value: String(perfCar.maintenanceDays),
                },
                {
                  label: 'Repair cost',
                  value:
                    canMoney && perfCar.repairCost != null
                      ? formatPrice(perfCar.repairCost)
                      : '—',
                },
                {
                  label: 'Service cost',
                  value:
                    canMoney && perfCar.serviceCost != null
                      ? formatPrice(perfCar.serviceCost)
                      : '—',
                },
                {
                  label: 'Profitability',
                  value:
                    canMoney && perfCar.profitability != null
                      ? formatPrice(perfCar.profitability)
                      : '—',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[var(--color-line)] p-3"
                >
                  <dt className="text-xs text-[var(--color-muted)]">{item.label}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
