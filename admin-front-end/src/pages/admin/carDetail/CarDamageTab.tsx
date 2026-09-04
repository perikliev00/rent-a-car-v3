import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { imageUrl } from '../../../utils/format';
import type { DamageForm } from './carDetailTypes';

type DamageReport = {
  id: number;
  description: string;
  status: string;
  reservationId?: string | null;
  repairCost?: number | null;
  photos?: string[];
};

export function CarDamageTab({
  damageForm,
  setDamageForm,
  setDamagePhotos,
  damageMutationPending,
  onCreateReport,
  damageLoading,
  reports,
  onResolve,
  onDelete,
}: {
  damageForm: DamageForm;
  setDamageForm: (v: DamageForm | ((prev: DamageForm) => DamageForm)) => void;
  setDamagePhotos: (files: FileList | null) => void;
  damageMutationPending: boolean;
  onCreateReport: () => void;
  damageLoading: boolean;
  reports: DamageReport[] | undefined;
  onResolve: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Report damage</h2>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateReport();
            }}
          >
            <Input
              label="Description"
              value={damageForm.description}
              onChange={(e) => setDamageForm({ ...damageForm, description: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              label="Reservation ID (optional)"
              value={damageForm.reservationId}
              onChange={(e) => setDamageForm({ ...damageForm, reservationId: e.target.value })}
            />
            <Input
              label="Repair cost"
              type="number"
              min={0}
              step="0.01"
              value={damageForm.repairCost}
              onChange={(e) => setDamageForm({ ...damageForm, repairCost: e.target.value })}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Photos (max 5)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-1 text-sm"
                onChange={(e) => setDamagePhotos(e.target.files)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={damageMutationPending}>
                Create report
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="shadow-none">
        <CardBody className="px-5 py-4">
          <h2 className="font-display font-semibold">Reports</h2>
          {damageLoading ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : !reports?.length ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No damage reports</p>
          ) : (
            <div className="mt-3 space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.description}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {r.status}
                        {r.reservationId ? ` · reservation #${r.reservationId}` : ''}
                        {r.repairCost != null ? ` · repair ${r.repairCost}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {r.status === 'unresolved' ? (
                        <Button size="sm" onClick={() => void onResolve(r.id)}>
                          Resolve
                        </Button>
                      ) : null}
                      <Button size="sm" variant="danger" onClick={() => void onDelete(r.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {r.photos?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.photos.map((url) => (
                        <img
                          key={url}
                          src={imageUrl(url)}
                          alt=""
                          className="h-16 w-16 rounded object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
