/**
 * Pickup/return checklist form with photos and signatures.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getReservationChecklists,
  // Contribute this line to the enclosing declaration or statement.
  submitPickupChecklist,
  // Contribute this line to the enclosing declaration or statement.
  submitReturnChecklist,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/reservations';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Card'.
import { Card, CardBody } from '../../../components/ui/Card';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/Textarea'.
import { Textarea } from '../../../components/ui/Textarea';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';

// Create the fuel options constant.
const FUEL_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: 'empty', label: 'Empty' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'quarter', label: '1/4' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'half', label: '1/2' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'three_quarters', label: '3/4' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'full', label: 'Full' },
];

/** Pickup/return checklist form with photos and signatures. */
export function ChecklistPanel({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  onChanged,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the reservation id field value.
  reservationId: string;
  // Provide the on changed field value.
  onChanged: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the checklists query constant.
  const checklistsQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'reservations', reservationId, 'checklists'],
    // Provide the query fn field value.
    queryFn: () => getReservationChecklists(reservationId),
  });

  // Destructure array values into local variables.
  const [fuelLevel, setFuelLevel] = useState('full');
  // Destructure array values into local variables.
  const [mileage, setMileage] = useState('');
  // Destructure array values into local variables.
  const [damages, setDamages] = useState('');
  // Destructure array values into local variables.
  const [notes, setNotes] = useState('');
  // Destructure array values into local variables.
  const [extraFees, setExtraFees] = useState('0');
  // Destructure array values into local variables.
  const [lateReturn, setLateReturn] = useState(false);
  // Destructure array values into local variables.
  const [photos, setPhotos] = useState<File[]>([]);
  // Destructure array values into local variables.
  const [customerSignature, setCustomerSignature] = useState<File | null>(null);
  // Destructure array values into local variables.
  const [employeeSignature, setEmployeeSignature] = useState<File | null>(null);

  // Create the pickup mutation constant.
  const pickupMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call submitPickupChecklist to perform this step.
      submitPickupChecklist(reservationId, {
        // Contribute this line to the enclosing declaration or statement.
        fuelLevel,
        // Provide the mileage field value.
        mileage: Number(mileage),
        // Provide the existing damages field value.
        existingDamages: damages,
        // Contribute this line to the enclosing declaration or statement.
        notes,
        // Contribute this line to the enclosing declaration or statement.
        photos,
        // Contribute this line to the enclosing declaration or statement.
        customerSignature,
        // Contribute this line to the enclosing declaration or statement.
        employeeSignature,
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Pickup checklist saved', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({
        // Provide the query key field value.
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      // Call onChanged to perform this step.
      onChanged();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message || 'Pickup checklist failed', 'error'),
  });

  // Create the return mutation constant.
  const returnMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call submitReturnChecklist to perform this step.
      submitReturnChecklist(reservationId, {
        // Contribute this line to the enclosing declaration or statement.
        fuelLevel,
        // Provide the mileage field value.
        mileage: Number(mileage),
        // Provide the new damages field value.
        newDamages: damages,
        // Contribute this line to the enclosing declaration or statement.
        notes,
        // Contribute this line to the enclosing declaration or statement.
        lateReturn,
        // Provide the extra fees field value.
        extraFees: Number(extraFees) || 0,
        // Contribute this line to the enclosing declaration or statement.
        photos,
        // Contribute this line to the enclosing declaration or statement.
        customerSignature,
        // Contribute this line to the enclosing declaration or statement.
        employeeSignature,
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Return checklist saved', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({
        // Provide the query key field value.
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      // Call onChanged to perform this step.
      onChanged();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message || 'Return checklist failed', 'error'),
  });

  // Return control to the caller with the following value.
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
