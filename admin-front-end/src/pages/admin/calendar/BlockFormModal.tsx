/**
 * Create/edit car block (maintenance/unavailable) with force option.
 */
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from 'date-fns'.
import { formatISO, parseISO } from 'date-fns';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createCalendarBlock,
  // Contribute this line to the enclosing declaration or statement.
  updateCalendarBlock,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/calendar';
// Import named exports from '../../../api/client'.
import { ApiError } from '../../../api/client';
// Import named exports from '../../../components/ui/Modal'.
import { Modal } from '../../../components/ui/Modal';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/DateSelect'.
import { DateSelect } from '../../../components/ui/DateSelect';
// Import named exports from '../../../components/ui/TimeSelect'.
import { TimeSelect } from '../../../components/ui/TimeSelect';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar, CalendarConflict } from './calendar.types';

/** Split Iso. */
function splitIso(iso: string | undefined): { date: string; time: string } {
  // Evaluate the condition and enter the branch when it is true.
  if (!iso) {
    // Create the now constant.
    const now = new Date();
    // Return the resulting value to the caller.
    return {
      // Provide the date field value.
      date: formatISO(now, { representation: 'date' }),
      // Provide the time field value.
      time: `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')}`,
    };
  }
  // Create the d constant.
  const d = typeof iso === 'string' && iso.includes('T') ? parseISO(iso) : new Date(iso);
  // Return the resulting value to the caller.
  return {
    // Provide the date field value.
    date: formatISO(d, { representation: 'date' }),
    // Provide the time field value.
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

/** Join Iso. */
function joinIso(date: string, time: string): string {
  // Return the resulting value to the caller.
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Create/edit car block (maintenance/unavailable) with force option. */
export function BlockFormModal({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  cars,
  // Update mode with the right-hand side value.
  mode = 'create',
  // Contribute this line to the enclosing declaration or statement.
  blockId,
  // Contribute this line to the enclosing declaration or statement.
  defaults,
  // Contribute this line to the enclosing declaration or statement.
  onConflict,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Provide the cars field value.
  cars: CalendarCar[];
  // Contribute this line to the enclosing declaration or statement.
  mode?: 'create' | 'edit';
  // Contribute this line to the enclosing declaration or statement.
  blockId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  defaults?: {
    // Contribute this line to the enclosing declaration or statement.
    carId?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    start?: string;
    // Contribute this line to the enclosing declaration or statement.
    end?: string;
    // Contribute this line to the enclosing declaration or statement.
    blockType?: string;
    // Contribute this line to the enclosing declaration or statement.
    reason?: string;
    // Contribute this line to the enclosing declaration or statement.
    notes?: string;
  };
  // Continue the surrounding logic with this statement.
  onConflict?: (conflicts: CalendarConflict[], retry: (force: boolean) => void) => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the start parts constant.
  const startParts = splitIso(defaults?.start);
  // Create the end default constant.
  const endDefault = defaults?.end
    // Continue the surrounding logic with this statement.
    ? splitIso(defaults.end)
    // Continue the surrounding logic with this statement.
    : splitIso(
        // Contribute this line to the enclosing declaration or statement.
        defaults?.start
          // Continue the surrounding logic with this statement.
          ? new Date(parseISO(defaults.start).getTime() + 2 * 3600_000).toISOString()
          // Contribute this line to the enclosing declaration or statement.
          : undefined
      );

  // Destructure array values into local variables.
  const [carId, setCarId] = useState(defaults?.carId || cars[0]?.id || '');
  // Destructure array values into local variables.
  const [startDate, setStartDate] = useState(startParts.date);
  // Destructure array values into local variables.
  const [startTime, setStartTime] = useState(startParts.time);
  // Destructure array values into local variables.
  const [endDate, setEndDate] = useState(endDefault.date);
  // Destructure array values into local variables.
  const [endTime, setEndTime] = useState(endDefault.time);
  // Destructure array values into local variables.
  const [blockType, setBlockType] = useState(defaults?.blockType || 'manual');
  // Destructure array values into local variables.
  const [reason, setReason] = useState(defaults?.reason || '');
  // Destructure array values into local variables.
  const [notes, setNotes] = useState(defaults?.notes || '');

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Create the s constant.
    const s = splitIso(defaults?.start);
    // Create the e constant.
    const e = defaults?.end
      // Continue the surrounding logic with this statement.
      ? splitIso(defaults.end)
      // Continue the surrounding logic with this statement.
      : splitIso(
          // Contribute this line to the enclosing declaration or statement.
          defaults?.start
            // Continue the surrounding logic with this statement.
            ? new Date(parseISO(defaults.start).getTime() + 2 * 3600_000).toISOString()
            // Contribute this line to the enclosing declaration or statement.
            : undefined
        );
    // Call setCarId to perform this step.
    setCarId(defaults?.carId || cars[0]?.id || '');
    // Call setStartDate to perform this step.
    setStartDate(s.date);
    // Call setStartTime to perform this step.
    setStartTime(s.time);
    // Call setEndDate to perform this step.
    setEndDate(e.date);
    // Call setEndTime to perform this step.
    setEndTime(e.time);
    // Call setBlockType to perform this step.
    setBlockType(defaults?.blockType || 'manual');
    // Call setReason to perform this step.
    setReason(defaults?.reason || '');
    // Call setNotes to perform this step.
    setNotes(defaults?.notes || '');
  // Continue the surrounding logic with this statement.
  }, [open, defaults, cars]);

  /** Submit. */
  async function submit(force = false) {
    // Create the body constant.
    const body = {
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the start field value.
      start: joinIso(startDate, startTime),
      // Provide the end field value.
      end: joinIso(endDate, endTime),
      // Contribute this line to the enclosing declaration or statement.
      blockType,
      // Provide the reason field value.
      reason: reason || undefined,
      // Provide the notes field value.
      notes: notes || undefined,
      // Contribute this line to the enclosing declaration or statement.
      force,
    };
    // Evaluate the condition and enter the branch when it is true.
    if (mode === 'edit' && blockId) {
      // Return the resulting value to the caller.
      return updateCalendarBlock(blockId, body);
    }
    // Return the resulting value to the caller.
    return createCalendarBlock(body);
  }

  // Create the mutation constant.
  const mutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => submit(false),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call toast to perform this step.
      toast(mode === 'edit' ? 'Block updated' : 'Block created', 'success');
      // Call onClose to perform this step.
      onClose();
    },
    // Provide the on error field value.
    onError: (err) => {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError && err.code === 'CALENDAR_CONFLICT') {
        // Continue the surrounding logic with this statement.
        onConflict?.((err.conflicts as CalendarConflict[]) || [], (force) => {
          // Continue the surrounding logic with this statement.
          void submit(force)
            // Call .then to perform this step.
            .then(() => {
              // Call queryClient.invalidateQueries to perform this step.
              queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
              // Call toast to perform this step.
              toast(mode === 'edit' ? 'Block updated' : 'Block created', 'success');
              // Call onClose to perform this step.
              onClose();
            })
            // Call .catch to perform this step.
            .catch((e) => toast((e as Error).message, 'error'));
        });
        // Return control to the caller with the following value.
        return;
      }
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    },
  });

  // Return control to the caller with the following value.
  return (
    <Modal open={open} onClose={onClose} title={mode === 'edit' ? 'Edit block' : 'Block car'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Select
          label="Car"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          options={cars.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          label="Type"
          value={blockType}
          onChange={(e) => setBlockType(e.target.value)}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DateSelect label="Start date" value={startDate} onChange={setStartDate} />
          <TimeSelect label="Start time" value={startTime} onChange={setStartTime} />
          <DateSelect label="End date" value={endDate} onChange={setEndDate} />
          <TimeSelect label="End time" value={endTime} onChange={setEndTime} />
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" loading={mutation.isPending}>
          {mode === 'edit' ? 'Save' : 'Create block'}
        </Button>
      </form>
    </Modal>
  );
}
