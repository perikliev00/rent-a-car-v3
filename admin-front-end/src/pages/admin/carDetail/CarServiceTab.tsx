/**
 * Service history list/create UI for a car.
 */
import { SERVICE_TYPE_OPTIONS } from '../../../api/admin/cars';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Card'.
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Contribute this line to the enclosing declaration or statement.
import type { ServiceForm } from './carDetailTypes';

// Declare the ServiceRecord TypeScript type alias.
type ServiceRecord = {
  // Provide the id field value.
  id: number;
  // Provide the service date field value.
  serviceDate: string;
  // Provide the service type field value.
  serviceType: string;
  // Contribute this line to the enclosing declaration or statement.
  cost?: number | null;
  // Contribute this line to the enclosing declaration or statement.
  mileage?: number | null;
  // Contribute this line to the enclosing declaration or statement.
  nextServiceDate?: string | null;
};

/** Service history list/create UI for a car. */
export function CarServiceTab({
  // Contribute this line to the enclosing declaration or statement.
  serviceForm,
  // Contribute this line to the enclosing declaration or statement.
  setServiceForm,
  // Contribute this line to the enclosing declaration or statement.
  serviceMutationPending,
  // Contribute this line to the enclosing declaration or statement.
  onAddService,
  // Contribute this line to the enclosing declaration or statement.
  serviceLoading,
  // Contribute this line to the enclosing declaration or statement.
  records,
  // Contribute this line to the enclosing declaration or statement.
  onDeleteRecord,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the service form field value.
  serviceForm: ServiceForm;
  // Provide the set service form field value.
  setServiceForm: (v: ServiceForm | ((prev: ServiceForm) => ServiceForm)) => void;
  // Provide the service mutation pending field value.
  serviceMutationPending: boolean;
  // Provide the on add service field value.
  onAddService: () => void;
  // Provide the service loading field value.
  serviceLoading: boolean;
  // Provide the records field value.
  records: ServiceRecord[] | undefined;
  // Provide the on delete record field value.
  onDeleteRecord: (recordId: number) => void;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Add service record</h2>
          <form
            className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onAddService();
            }}
          >
            <Select
              label="Type"
              value={serviceForm.serviceType}
              onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
              options={SERVICE_TYPE_OPTIONS}
            />
            <Input
              label="Service date"
              type="date"
              value={serviceForm.serviceDate}
              onChange={(e) => setServiceForm({ ...serviceForm, serviceDate: e.target.value })}
              required
            />
            <Input
              label="Next service date"
              type="date"
              value={serviceForm.nextServiceDate}
              onChange={(e) => setServiceForm({ ...serviceForm, nextServiceDate: e.target.value })}
            />
            <Input
              label="Cost"
              type="number"
              min={0}
              step="0.01"
              value={serviceForm.cost}
              onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
            />
            <Input
              label="Mileage"
              type="number"
              min={0}
              value={serviceForm.mileage}
              onChange={(e) => setServiceForm({ ...serviceForm, mileage: e.target.value })}
            />
            <Input
              label="Description"
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={serviceMutationPending}>
                Add record
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">History</h2>
          {serviceLoading ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : !records?.length ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No service records</p>
          ) : (
            <div className="mt-3 min-w-0 overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead>
                  <tr className="border-b text-[var(--color-muted)]">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Cost</th>
                    <th className="pb-2 pr-3">Mileage</th>
                    <th className="pb-2 pr-3">Next</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-line)]/60">
                      <td className="py-1.5 pr-3">{r.serviceDate}</td>
                      <td className="py-1.5 pr-3">{r.serviceType}</td>
                      <td className="py-1.5 pr-3">{r.cost ?? '—'}</td>
                      <td className="py-1.5 pr-3">{r.mileage ?? '—'}</td>
                      <td className="py-1.5 pr-3">{r.nextServiceDate || '—'}</td>
                      <td className="py-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void onDeleteRecord(r.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
