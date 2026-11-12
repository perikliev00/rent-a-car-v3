/**
 * Car overview/edit form and fleet status controls.
 */
import {
  // Contribute this line to the enclosing declaration or statement.
  CAR_FLEET_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVEL_OPTIONS,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Card'.
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Contribute this line to the enclosing declaration or statement.
import type { CarFleetStatus, FuelLevel, OverviewForm } from './carDetailTypes';

// Declare the CarLike TypeScript type alias.
type CarLike = {
  // Contribute this line to the enclosing declaration or statement.
  status?: string;
};

/** Car overview/edit form and fleet status controls. */
export function CarOverviewTab({
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  fleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  setFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  overviewForm,
  // Contribute this line to the enclosing declaration or statement.
  setOverviewForm,
  // Contribute this line to the enclosing declaration or statement.
  statusMutationPending,
  // Contribute this line to the enclosing declaration or statement.
  overviewMutationPending,
  // Contribute this line to the enclosing declaration or statement.
  onApplyStatus,
  // Contribute this line to the enclosing declaration or statement.
  onSaveOverview,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the car field value.
  car: CarLike;
  // Provide the fleet status field value.
  fleetStatus: CarFleetStatus | '';
  // Provide the set fleet status field value.
  setFleetStatus: (v: CarFleetStatus | '') => void;
  // Provide the overview form field value.
  overviewForm: OverviewForm;
  // Provide the set overview form field value.
  setOverviewForm: (v: OverviewForm | ((prev: OverviewForm) => OverviewForm)) => void;
  // Provide the status mutation pending field value.
  statusMutationPending: boolean;
  // Provide the overview mutation pending field value.
  overviewMutationPending: boolean;
  // Provide the on apply status field value.
  onApplyStatus: () => void;
  // Provide the on save overview field value.
  onSaveOverview: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
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
            className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
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
