import {
  CAR_FLEET_STATUSES,
  FUEL_LEVEL_OPTIONS,
} from '../../../api/admin/cars';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { CarFleetStatus, FuelLevel, OverviewForm } from './carDetailTypes';

type CarLike = {
  status?: string;
};

export function CarOverviewTab({
  car,
  fleetStatus,
  setFleetStatus,
  overviewForm,
  setOverviewForm,
  statusMutationPending,
  overviewMutationPending,
  onApplyStatus,
  onSaveOverview,
}: {
  car: CarLike;
  fleetStatus: CarFleetStatus | '';
  setFleetStatus: (v: CarFleetStatus | '') => void;
  overviewForm: OverviewForm;
  setOverviewForm: (v: OverviewForm | ((prev: OverviewForm) => OverviewForm)) => void;
  statusMutationPending: boolean;
  overviewMutationPending: boolean;
  onApplyStatus: () => void;
  onSaveOverview: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Fleet status</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Select
              value={fleetStatus}
              onChange={(e) => setFleetStatus(e.target.value as CarFleetStatus | '')}
              className="min-w-[12rem]"
              options={[
                { value: '', label: 'Change…' },
                ...CAR_FLEET_STATUSES.filter((s) => s !== car.status).map((s) => ({
                  value: s,
                  label: s,
                })),
              ]}
            />
            <Button
              size="sm"
              disabled={!fleetStatus || statusMutationPending}
              loading={statusMutationPending}
              onClick={onApplyStatus}
            >
              Apply
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Hard-blocked when status is in_maintenance, damaged, or inactive.
            Reserved/rented/cleaning still allow other free date ranges.
          </p>
        </CardBody>
      </Card>

      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Fleet details</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveOverview();
            }}
          >
            <Input
              label="Registration number"
              value={overviewForm.registrationNumber}
              onChange={(e) => setOverviewForm({ ...overviewForm, registrationNumber: e.target.value })}
            />
            <Input
              label="VIN"
              value={overviewForm.vin}
              onChange={(e) => setOverviewForm({ ...overviewForm, vin: e.target.value })}
            />
            <Input
              label="Mileage"
              type="number"
              min={0}
              value={overviewForm.mileage}
              onChange={(e) => setOverviewForm({ ...overviewForm, mileage: e.target.value })}
            />
            <Select
              label="Fuel level"
              value={overviewForm.fuelLevel}
              onChange={(e) =>
                setOverviewForm({ ...overviewForm, fuelLevel: e.target.value as FuelLevel | '' })
              }
              options={FUEL_LEVEL_OPTIONS}
            />
            <Input
              label="Current location"
              value={overviewForm.currentLocation}
              onChange={(e) => setOverviewForm({ ...overviewForm, currentLocation: e.target.value })}
            />
            <Input
              label="Insurance expiry"
              type="date"
              value={overviewForm.insuranceExpiry}
              onChange={(e) => setOverviewForm({ ...overviewForm, insuranceExpiry: e.target.value })}
            />
            <Input
              label="Technical inspection expiry"
              type="date"
              value={overviewForm.technicalInspectionExpiry}
              onChange={(e) =>
                setOverviewForm({ ...overviewForm, technicalInspectionExpiry: e.target.value })
              }
            />
            <p className="sm:col-span-2 text-xs text-[var(--color-muted)]">
              Insurance and technical inspection dates also sync to Compliance items.
            </p>
            <div className="sm:col-span-2">
              <Button type="submit" loading={overviewMutationPending}>
                Save details
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
