import { useState } from 'react';
import { formatISO } from 'date-fns';

type TaskDefaults = {
  title?: string;
  taskType?: string;
  carId?: string | null;
  startsAt?: string | null;
  dueAt?: string | null;
  locationText?: string | null;
  notes?: string | null;
  assignedToUserId?: string | null;
  reservationId?: string | null;
};

type BlockDefaults = {
  carId?: string | null;
  start?: string;
  end?: string;
  blockType?: string;
  reason?: string;
  notes?: string;
};

type QuickMenu = {
  x: number;
  y: number;
  carId: string;
  at: Date;
};

export function useCalendarModals() {
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<'create' | 'edit'>('create');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<TaskDefaults>({});
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockMode, setBlockMode] = useState<'create' | 'edit'>('create');
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blockDefaults, setBlockDefaults] = useState<BlockDefaults>({});
  const [menu, setMenu] = useState<QuickMenu | null>(null);

  function openCreateTask(carId: string | null, at?: Date) {
    setTaskMode('create');
    setTaskId(null);
    setTaskDefaults({
      carId,
      startsAt: at?.toISOString(),
      dueAt: at ? new Date(at.getTime() + 3600_000).toISOString() : undefined,
    });
    setTaskOpen(true);
  }

  function openCreateBlock(carId: string | null, at?: Date) {
    setBlockMode('create');
    setBlockId(null);
    setBlockDefaults({
      carId,
      start: at?.toISOString(),
      end: at ? new Date(at.getTime() + 2 * 3600_000).toISOString() : undefined,
    });
    setBlockOpen(true);
  }

  function editTask(task: Record<string, unknown>) {
    setTaskMode('edit');
    setTaskId(String(task.id));
    setTaskDefaults({
      title: String(task.title || ''),
      taskType: String(task.taskType || 'pickup'),
      carId: task.carId ? String(task.carId) : null,
      startsAt: task.startsAt ? String(task.startsAt) : null,
      dueAt: task.dueAt ? String(task.dueAt) : null,
      locationText: task.locationText ? String(task.locationText) : null,
      notes: task.notes ? String(task.notes) : null,
      assignedToUserId: task.assignedToUserId ? String(task.assignedToUserId) : null,
      reservationId: task.reservationId ? String(task.reservationId) : null,
    });
    setTaskOpen(true);
  }

  function editBlock(block: Record<string, unknown>, eid: string) {
    const rawId = eid.startsWith('blocked:') ? eid.slice('blocked:'.length) : eid;
    setBlockMode('edit');
    setBlockId(rawId);
    const meta = (block.meta || {}) as { blockType?: string; notes?: string };
    setBlockDefaults({
      carId: block.carId ? String(block.carId) : null,
      start: block.start ? String(block.start) : undefined,
      end: block.end ? String(block.end) : undefined,
      blockType: meta.blockType || String(block.status || 'manual'),
      reason: block.title ? String(block.title) : '',
      notes: meta.notes || '',
    });
    setBlockOpen(true);
  }

  function openEventFromDay(id: string) {
    setEventId(id);
    setDayDate(null);
  }

  function openMenuFromDay(carId: string) {
    if (!dayDate) return;
    const at = new Date(`${dayDate}T12:00:00`);
    setMenu({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      carId,
      at,
    });
  }

  function createTaskFromMenu() {
    if (!menu) return;
    openCreateTask(menu.carId, menu.at);
    setMenu(null);
  }

  function createBlockFromMenu() {
    if (!menu) return;
    openCreateBlock(menu.carId, menu.at);
    setMenu(null);
  }

  function openDayFromMenu() {
    if (!menu) return;
    setDayDate(formatISO(menu.at, { representation: 'date' }));
    setMenu(null);
  }

  return {
    dayDate,
    setDayDate,
    eventId,
    setEventId,
    taskOpen,
    taskMode,
    taskId,
    taskDefaults,
    setTaskDefaults,
    setTaskOpen,
    blockOpen,
    blockMode,
    blockId,
    blockDefaults,
    setBlockOpen,
    menu,
    setMenu,
    openCreateTask,
    openCreateBlock,
    editTask,
    editBlock,
    openEventFromDay,
    openMenuFromDay,
    createTaskFromMenu,
    createBlockFromMenu,
    openDayFromMenu,
  };
}
