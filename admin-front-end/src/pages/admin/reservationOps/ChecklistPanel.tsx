import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReservationChecklists,
  submitPickupChecklist,
  submitReturnChecklist,
} from '../../../api/admin/reservations';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toast } from '../../../components/ui/toastStore';

const FUEL_OPTIONS = [
  { value: 'empty', label: 'Empty' },
  { value: 'quarter', label: '1/4' },
  { value: 'half', label: '1/2' },
  { value: 'three_quarters', label: '3/4' },
  { value: 'full', label: 'Full' },
];

export function ChecklistPanel({
  reservationId,
  onChanged,
}: {
  reservationId: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const checklistsQuery = useQuery({
    queryKey: ['admin', 'reservations', reservationId, 'checklists'],
    queryFn: () => getReservationChecklists(reservationId),
  });

  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [damages, setDamages] = useState('');
  const [notes, setNotes] = useState('');
  const [extraFees, setExtraFees] = useState('0');
  const [lateReturn, setLateReturn] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [customerSignature, setCustomerSignature] = useState<File | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState<File | null>(null);

  const pickupMutation = useMutation({
    mutationFn: () =>
      submitPickupChecklist(reservationId, {
        fuelLevel,
        mileage: Number(mileage),
        existingDamages: damages,
        notes,
        photos,
        customerSignature,
        employeeSignature,
      }),
    onSuccess: () => {
      toast('Pickup checklist saved', 'success');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Pickup checklist failed', 'error'),
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      submitReturnChecklist(reservationId, {
        fuelLevel,
        mileage: Number(mileage),
        newDamages: damages,
        notes,
        lateReturn,
        extraFees: Number(extraFees) || 0,
        photos,
        customerSignature,
        employeeSignature,
      }),
    onSuccess: () => {
      toast('Return checklist saved', 'success');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Return checklist failed', 'error'),
  });

  return (
    <Card className="mt-4 shadow-none">
      <CardBody className="space-y-4 px-5 py-4">
        <h3 className="font-display font-semibold text-[var(--color-ink)]">
          Pickup / return checklist · #{reservationId}
        </h3>
        {checklistsQuery.data?.pickupChecklist ? (
          <p className="text-xs text-[var(--color-success)]">Pickup checklist on file</p>
        ) : null}
        {checklistsQuery.data?.returnChecklist ? (
          <p className="text-xs text-[var(--color-success)]">Return checklist on file</p>
        ) : null}
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Fuel level"
            value={fuelLevel}
            onChange={(e) => setFuelLevel(e.target.value)}
            options={FUEL_OPTIONS}
          />
          <Input
            label="Mileage"
            type="number"
            min={0}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>
        <Textarea
          label="Damages / notes description"
          value={damages}
          onChange={(e) => setDamages(e.target.value)}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input
          label="Extra fees (return)"
          type="number"
          min={0}
          step="0.01"
          value={extraFees}
          onChange={(e) => setExtraFees(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={lateReturn}
            onChange={(e) => setLateReturn(e.target.checked)}
          />
          Late return
        </label>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            Photos (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 5))}
            className="block w-full text-sm"
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Customer signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCustomerSignature(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Employee signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEmployeeSignature(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={pickupMutation.isPending}
            disabled={!mileage}
            onClick={() => pickupMutation.mutate()}
          >
            Save pickup checklist
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={returnMutation.isPending}
            disabled={!mileage}
            onClick={() => returnMutation.mutate()}
          >
            Save return checklist
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
