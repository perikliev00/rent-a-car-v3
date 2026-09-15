import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatISO, parseISO } from 'date-fns';
import {
  createCalendarBlock,
  updateCalendarBlock,
} from '../../../api/admin/calendar';
import { ApiError } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { DateSelect } from '../../../components/ui/DateSelect';
import { TimeSelect } from '../../../components/ui/TimeSelect';
import { toast } from '../../../components/ui/toastStore';
import type { CalendarCar, CalendarConflict } from './calendar.types';

function splitIso(iso: string | undefined): { date: string; time: string } {
  if (!iso) {
    const now = new Date();
    return {
      date: formatISO(now, { representation: 'date' }),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')}`,
    };
  }
  const d = typeof iso === 'string' && iso.includes('T') ? parseISO(iso) : new Date(iso);
  return {
    date: formatISO(d, { representation: 'date' }),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function joinIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function BlockFormModal({
  open,
  onClose,
  cars,
  mode = 'create',
  blockId,
  defaults,
  onConflict,
}: {
  open: boolean;
  onClose: () => void;
  cars: CalendarCar[];
  mode?: 'create' | 'edit';
  blockId?: string | null;
  defaults?: {
    carId?: string | null;
    start?: string;
    end?: string;
    blockType?: string;
    reason?: string;
    notes?: string;
  };
  onConflict?: (conflicts: CalendarConflict[], retry: (force: boolean) => void) => void;
}) {
  const queryClient = useQueryClient();
  const startParts = splitIso(defaults?.start);
  const endDefault = defaults?.end
    ? splitIso(defaults.end)
    : splitIso(
        defaults?.start
          ? new Date(parseISO(defaults.start).getTime() + 2 * 3600_000).toISOString()
          : undefined
      );

  const [carId, setCarId] = useState(defaults?.carId || cars[0]?.id || '');
  const [startDate, setStartDate] = useState(startParts.date);
  const [startTime, setStartTime] = useState(startParts.time);
  const [endDate, setEndDate] = useState(endDefault.date);
  const [endTime, setEndTime] = useState(endDefault.time);
  const [blockType, setBlockType] = useState(defaults?.blockType || 'manual');
  const [reason, setReason] = useState(defaults?.reason || '');
  const [notes, setNotes] = useState(defaults?.notes || '');

  useEffect(() => {
    if (!open) return;
    const s = splitIso(defaults?.start);
    const e = defaults?.end
      ? splitIso(defaults.end)
      : splitIso(
          defaults?.start
            ? new Date(parseISO(defaults.start).getTime() + 2 * 3600_000).toISOString()
            : undefined
        );
    setCarId(defaults?.carId || cars[0]?.id || '');
    setStartDate(s.date);
    setStartTime(s.time);
    setEndDate(e.date);
    setEndTime(e.time);
    setBlockType(defaults?.blockType || 'manual');
    setReason(defaults?.reason || '');
    setNotes(defaults?.notes || '');
  }, [open, defaults, cars]);

  async function submit(force = false) {
    const body = {
      carId,
      start: joinIso(startDate, startTime),
      end: joinIso(endDate, endTime),
      blockType,
      reason: reason || undefined,
      notes: notes || undefined,
      force,
    };
    if (mode === 'edit' && blockId) {
      return updateCalendarBlock(blockId, body);
    }
    return createCalendarBlock(body);
  }

  const mutation = useMutation({
    mutationFn: () => submit(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      toast(mode === 'edit' ? 'Block updated' : 'Block created', 'success');
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CALENDAR_CONFLICT') {
        onConflict?.((err.conflicts as CalendarConflict[]) || [], (force) => {
          void submit(force)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
              toast(mode === 'edit' ? 'Block updated' : 'Block created', 'success');
              onClose();
            })
            .catch((e) => toast((e as Error).message, 'error'));
        });
        return;
      }
      toast((err as Error).message, 'error');
    },
  });

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
