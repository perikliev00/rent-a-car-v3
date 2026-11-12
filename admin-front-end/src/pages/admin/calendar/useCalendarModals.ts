/**
 * Central modal/drawer open state for calendar interactions.
 */
import { useState } from 'react';
// Import named exports from 'date-fns'.
import { formatISO } from 'date-fns';

// Declare the TaskDefaults TypeScript type alias.
type TaskDefaults = {
  // Contribute this line to the enclosing declaration or statement.
  title?: string;
  // Contribute this line to the enclosing declaration or statement.
  taskType?: string;
  // Contribute this line to the enclosing declaration or statement.
  carId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  startsAt?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  dueAt?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  locationText?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  notes?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  assignedToUserId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  reservationId?: string | null;
};

// Declare the BlockDefaults TypeScript type alias.
type BlockDefaults = {
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

// Declare the QuickMenu TypeScript type alias.
type QuickMenu = {
  // Provide the x field value.
  x: number;
  // Provide the y field value.
  y: number;
  // Provide the car id field value.
  carId: string;
  // Provide the at field value.
  at: Date;
};

/**
 * Owns day-ops, event-details, task/block form, and quick-create menu state.
 * Returns setters plus helpers that seed defaults before opening each overlay.
 */
export function useCalendarModals() {
  // Destructure array values into local variables.
  const [dayDate, setDayDate] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [eventId, setEventId] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [taskOpen, setTaskOpen] = useState(false);
  // Destructure array values into local variables.
  const [taskMode, setTaskMode] = useState<'create' | 'edit'>('create');
  // Destructure array values into local variables.
  const [taskId, setTaskId] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [taskDefaults, setTaskDefaults] = useState<TaskDefaults>({});
  // Destructure array values into local variables.
  const [blockOpen, setBlockOpen] = useState(false);
  // Destructure array values into local variables.
  const [blockMode, setBlockMode] = useState<'create' | 'edit'>('create');
  // Destructure array values into local variables.
  const [blockId, setBlockId] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [blockDefaults, setBlockDefaults] = useState<BlockDefaults>({});
  // Destructure array values into local variables.
  const [menu, setMenu] = useState<QuickMenu | null>(null);

  /**
   * Open the task form in create mode with optional car and start (due = +1h).
   * @param carId - Target car, or null when unset
   * @param at - Optional start timestamp
   */
  function openCreateTask(carId: string | null, at?: Date) {
    // Call setTaskMode to perform this step.
    setTaskMode('create');
    // Call setTaskId to perform this step.
    setTaskId(null);
    // Call setTaskDefaults to perform this step.
    setTaskDefaults({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the starts at field value.
      startsAt: at?.toISOString(),
      // Default one-hour task window when a start was provided.
      dueAt: at ? new Date(at.getTime() + 3600_000).toISOString() : undefined,
    });
    // Call setTaskOpen to perform this step.
    setTaskOpen(true);
  }

  /**
   * Open the block form in create mode (default duration +2h when `at` given).
   * @param carId - Target car, or null when unset
   * @param at - Optional block start
   */
  function openCreateBlock(carId: string | null, at?: Date) {
    // Call setBlockMode to perform this step.
    setBlockMode('create');
    // Call setBlockId to perform this step.
    setBlockId(null);
    // Call setBlockDefaults to perform this step.
    setBlockDefaults({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the start field value.
      start: at?.toISOString(),
      // Provide the end field value.
      end: at ? new Date(at.getTime() + 2 * 3600_000).toISOString() : undefined,
    });
    // Call setBlockOpen to perform this step.
    setBlockOpen(true);
  }

  /**
   * Open the task form prefilled from an existing task payload.
   * @param task - Task-like record from event details
   */
  function editTask(task: Record<string, unknown>) {
    // Call setTaskMode to perform this step.
    setTaskMode('edit');
    // Call setTaskId to perform this step.
    setTaskId(String(task.id));
    // Call setTaskDefaults to perform this step.
    setTaskDefaults({
      // Provide the title field value.
      title: String(task.title || ''),
      // Provide the task type field value.
      taskType: String(task.taskType || 'pickup'),
      // Provide the car id field value.
      carId: task.carId ? String(task.carId) : null,
      // Provide the starts at field value.
      startsAt: task.startsAt ? String(task.startsAt) : null,
      // Provide the due at field value.
      dueAt: task.dueAt ? String(task.dueAt) : null,
      // Provide the location text field value.
      locationText: task.locationText ? String(task.locationText) : null,
      // Provide the notes field value.
      notes: task.notes ? String(task.notes) : null,
      // Provide the assigned to user id field value.
      assignedToUserId: task.assignedToUserId ? String(task.assignedToUserId) : null,
      // Provide the reservation id field value.
      reservationId: task.reservationId ? String(task.reservationId) : null,
    });
    // Call setTaskOpen to perform this step.
    setTaskOpen(true);
  }

  /**
   * Open the block form prefilled from a blocked event; strips `blocked:` id prefix.
   * @param block - Block event payload
   * @param eid - Calendar event id (may be prefixed)
   */
  function editBlock(block: Record<string, unknown>, eid: string) {
    // API update expects the raw manual-event id, not the composite calendar id.
    const rawId = eid.startsWith('blocked:') ? eid.slice('blocked:'.length) : eid;
    // Call setBlockMode to perform this step.
    setBlockMode('edit');
    // Call setBlockId to perform this step.
    setBlockId(rawId);
    // Create the meta constant.
    const meta = (block.meta || {}) as { blockType?: string; notes?: string };
    // Call setBlockDefaults to perform this step.
    setBlockDefaults({
      // Provide the car id field value.
      carId: block.carId ? String(block.carId) : null,
      // Provide the start field value.
      start: block.start ? String(block.start) : undefined,
      // Provide the end field value.
      end: block.end ? String(block.end) : undefined,
      // Provide the block type field value.
      blockType: meta.blockType || String(block.status || 'manual'),
      // Provide the reason field value.
      reason: block.title ? String(block.title) : '',
      // Provide the notes field value.
      notes: meta.notes || '',
    });
    // Call setBlockOpen to perform this step.
    setBlockOpen(true);
  }

  /**
   * Switch from day-ops modal to event details for a clicked agenda row.
   * @param id - Calendar event id
   */
  function openEventFromDay(id: string) {
    // Call setEventId to perform this step.
    setEventId(id);
    // Call setDayDate to perform this step.
    setDayDate(null);
  }

  /**
   * Open the quick-create menu centered on screen for the active dayDate’s noon.
   * @param carId - Car row the day-ops UI is acting on
   */
  function openMenuFromDay(carId: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (!dayDate) return;
    // Noon local avoids DST edge cases when deriving the menu timestamp.
    const at = new Date(`${dayDate}T12:00:00`);
    // Call setMenu to perform this step.
    setMenu({
      // Provide the x field value.
      x: window.innerWidth / 2,
      // Provide the y field value.
      y: window.innerHeight / 2,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      at,
    });
  }

  /** Create-task action from the quick menu; closes the menu afterward. */
  function createTaskFromMenu() {
    // Evaluate the condition and enter the branch when it is true.
    if (!menu) return;
    // Call openCreateTask to perform this step.
    openCreateTask(menu.carId, menu.at);
    // Call setMenu to perform this step.
    setMenu(null);
  }

  /** Create-block action from the quick menu; closes the menu afterward. */
  function createBlockFromMenu() {
    // Evaluate the condition and enter the branch when it is true.
    if (!menu) return;
    // Call openCreateBlock to perform this step.
    openCreateBlock(menu.carId, menu.at);
    // Call setMenu to perform this step.
    setMenu(null);
  }

  /** Open day-ops for the menu’s date; closes the menu afterward. */
  function openDayFromMenu() {
    // Evaluate the condition and enter the branch when it is true.
    if (!menu) return;
    // Call setDayDate to perform this step.
    setDayDate(formatISO(menu.at, { representation: 'date' }));
    // Call setMenu to perform this step.
    setMenu(null);
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    dayDate,
    // Contribute this line to the enclosing declaration or statement.
    setDayDate,
    // Contribute this line to the enclosing declaration or statement.
    eventId,
    // Contribute this line to the enclosing declaration or statement.
    setEventId,
    // Contribute this line to the enclosing declaration or statement.
    taskOpen,
    // Contribute this line to the enclosing declaration or statement.
    taskMode,
    // Contribute this line to the enclosing declaration or statement.
    taskId,
    // Contribute this line to the enclosing declaration or statement.
    taskDefaults,
    // Contribute this line to the enclosing declaration or statement.
    setTaskDefaults,
    // Contribute this line to the enclosing declaration or statement.
    setTaskOpen,
    // Contribute this line to the enclosing declaration or statement.
    blockOpen,
    // Contribute this line to the enclosing declaration or statement.
    blockMode,
    // Contribute this line to the enclosing declaration or statement.
    blockId,
    // Contribute this line to the enclosing declaration or statement.
    blockDefaults,
    // Contribute this line to the enclosing declaration or statement.
    setBlockOpen,
    // Contribute this line to the enclosing declaration or statement.
    menu,
    // Contribute this line to the enclosing declaration or statement.
    setMenu,
    // Contribute this line to the enclosing declaration or statement.
    openCreateTask,
    // Contribute this line to the enclosing declaration or statement.
    openCreateBlock,
    // Contribute this line to the enclosing declaration or statement.
    editTask,
    // Contribute this line to the enclosing declaration or statement.
    editBlock,
    // Contribute this line to the enclosing declaration or statement.
    openEventFromDay,
    // Contribute this line to the enclosing declaration or statement.
    openMenuFromDay,
    // Contribute this line to the enclosing declaration or statement.
    createTaskFromMenu,
    // Contribute this line to the enclosing declaration or statement.
    createBlockFromMenu,
    // Contribute this line to the enclosing declaration or statement.
    openDayFromMenu,
  };
}
