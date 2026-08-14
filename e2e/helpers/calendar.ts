import type { Page, APIRequestContext, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { apiPost, apiPatch, apiDelete, loginAsAdmin, type ApiSession } from './csrf';
import { parseSofiaDate, type AllocatedFutureRange } from './dates';

export function toSofiaIso(date: string, time = '10:00'): string {
  const parsed = parseSofiaDate(date, time);
  if (!parsed) {
    throw new Error(`toSofiaIso: invalid Sofia date/time ${date} ${time}`);
  }
  return parsed.toISOString();
}

export function rangeToIso(range: AllocatedFutureRange): { start: string; end: string } {
  return {
    start: toSofiaIso(range.pickupDate, range.pickupTime),
    end: toSofiaIso(range.returnDate, range.returnTime),
  };
}

export async function openCalendarWeek(page: Page, date: string): Promise<void> {
  await page.goto(`/admin/calendar?view=week&date=${date}`);
  await expect(page.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
    timeout: 15_000,
  });
}

export async function openCalendarMonth(page: Page, date: string): Promise<void> {
  await page.goto(`/admin/calendar?view=month&date=${date}`);
  await expect(page.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('month-fleet-grid')).toBeVisible({ timeout: 15_000 });
}

/** Pick a YYYY-MM-DD value in a DateSelect (aria-label on day buttons). */
export async function pickDateSelect(page: Page, label: string, isoDate: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  const picker = page.getByRole('dialog', { name: `${label} picker` });
  await picker.waitFor({ state: 'visible', timeout: 10_000 });
  for (let i = 0; i < 24; i += 1) {
    const dayBtn = picker.getByRole('button', { name: isoDate });
    if (await dayBtn.isVisible().catch(() => false)) {
      await dayBtn.click();
      return;
    }
    await picker.getByRole('button', { name: 'Next month' }).click();
  }
  throw new Error(`pickDateSelect: could not find ${isoDate} for ${label}`);
}

/** Pick HH:mm in a TimeSelect. */
export async function pickTimeSelect(page: Page, label: string, hhmm: string): Promise<void> {
  const [hour, minute] = hhmm.split(':');
  const trigger = page.getByRole('button', { name: label, exact: true });
  await trigger.click();
  const picker = page.getByRole('dialog', { name: `${label} picker` });
  await picker.waitFor({ state: 'visible', timeout: 10_000 });
  // Hour and minute columns both contain overlapping labels (e.g. "00").
  const columns = picker.locator('ul');
  await columns.nth(0).getByRole('button', { name: hour, exact: true }).click();
  await columns.nth(1).getByRole('button', { name: minute, exact: true }).click();
  // Toggle closed — Escape would also dismiss parent Modals (e.g. Block car).
  await trigger.click();
  await expect(picker).toBeHidden({ timeout: 5_000 });
}

async function adminSession(
  request: APIRequestContext,
  session?: ApiSession
): Promise<ApiSession> {
  return session || (await loginAsAdmin(request));
}

export async function createManualBlockViaApi(
  request: APIRequestContext,
  body: {
    carId: number | string;
    start: string;
    end: string;
    blockType?: string;
    reason?: string;
    notes?: string;
    force?: boolean;
  },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = await adminSession(request, session);
  const res = await apiPost(
    request,
    '/api/admin/calendar/manual-events',
    {
      carId: Number(body.carId),
      start: body.start,
      end: body.end,
      blockType: body.blockType ?? 'manual',
      reason: body.reason,
      notes: body.notes,
      force: body.force ?? false,
    },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function deleteManualBlockViaApi(
  request: APIRequestContext,
  blockId: number | string,
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = await adminSession(request, session);
  const res = await apiDelete(request, `/api/admin/calendar/manual-events/${blockId}`, auth);
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function moveCalendarEventViaApi(
  request: APIRequestContext,
  reservationId: number | string,
  body: { start: string; end: string; carId?: number | string; force?: boolean },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = await adminSession(request, session);
  const res = await apiPatch(
    request,
    `/api/admin/calendar/events/reservation:${reservationId}/move`,
    {
      start: body.start,
      end: body.end,
      carId: body.carId != null ? Number(body.carId) : undefined,
      force: body.force ?? false,
    },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function resizeCalendarEventViaApi(
  request: APIRequestContext,
  reservationId: number | string,
  body: { start: string; end: string; carId?: number | string; force?: boolean },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = await adminSession(request, session);
  const res = await apiPatch(
    request,
    `/api/admin/calendar/events/reservation:${reservationId}/resize`,
    {
      start: body.start,
      end: body.end,
      carId: body.carId != null ? Number(body.carId) : undefined,
      force: body.force ?? false,
    },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function cancelCalendarReservationViaApi(
  request: APIRequestContext,
  reservationId: number | string,
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = await adminSession(request, session);
  const res = await apiPost(
    request,
    `/api/admin/calendar/reservations/${reservationId}/cancel`,
    {},
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

async function safeJson(res: APIResponse): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { text: await res.text().catch(() => '') };
  }
}

/** Parse blocked:{id} from create-manual-event response. */
export function blockIdFromCreateResponse(body: any): number | null {
  const eventId = body?.data?.event?.id || body?.data?.id;
  if (typeof eventId === 'string' && eventId.startsWith('blocked:')) {
    return Number(eventId.split(':')[1]);
  }
  if (typeof eventId === 'number') return eventId;
  return null;
}

export function calendarEventTestId(reservationId: number | string): string {
  return `cal-event-${reservationId}`;
}

/**
 * Pointer-drag a reservation event along the same car track (positive = later).
 */
export async function dragCalendarEventByOffset(
  page: Page,
  reservationId: number | string,
  options?: { dayOffsetPx?: number; expectOk?: boolean }
): Promise<APIResponse> {
  const event = page.getByTestId(calendarEventTestId(reservationId));
  await expect(event).toBeVisible({ timeout: 15_000 });
  const handle = event.getByTestId('cal-move-handle');
  await expect(handle).toBeVisible({ timeout: 15_000 });
  const track = event.locator('xpath=ancestor::*[@data-track="1"][1]');
  const trackBox = await track.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!trackBox || !handleBox) {
    throw new Error('dragCalendarEventByOffset: missing bounding boxes');
  }
  const dayOffsetPx = options?.dayOffsetPx ?? Math.max(280, Math.floor(trackBox.width / 3));
  const expectOk = options?.expectOk !== false;
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = Math.min(
    trackBox.x + trackBox.width - 16,
    Math.max(trackBox.x + 16, startX + dayOffsetPx)
  );

  const moveWait = page.waitForResponse(
    (res) => res.url().includes('/move') && res.request().method() === 'PATCH',
    { timeout: 20_000 }
  );

  // Dispatch PointerEvents through the React tree (more reliable than mouse for this calendar).
  await handle.evaluate(
    (el, { x0, y0, x1, y1 }) => {
      const fire = (type: string, x: number, y: number, buttons: number) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'mouse',
            buttons,
            view: window,
          })
        );
      };
      fire('pointerdown', x0, y0, 1);
      const steps = 12;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        fire('pointermove', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1);
      }
      fire('pointerup', x1, y1, 0);
    },
    { x0: startX, y0: startY, x1: endX, y1: startY }
  );

  const moveRes = await moveWait;
  if (expectOk && !moveRes.ok()) {
    throw new Error(
      `dragCalendarEventByOffset: move failed (${moveRes.status()}): ${await moveRes.text()}`
    );
  }
  return moveRes;
}

/** Pointer-drag the end resize handle by deltaX pixels (positive lengthens). */
export async function resizeCalendarEventEnd(
  page: Page,
  reservationId: number | string,
  deltaX: number
): Promise<void> {
  const event = page.getByTestId(calendarEventTestId(reservationId));
  await expect(event).toBeVisible({ timeout: 15_000 });
  const handle = event.getByTestId('cal-resize-end');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error('resizeCalendarEventEnd: handle has no box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 12 });
  await page.mouse.up();
}

export function calendarTrackTestId(carId: number | string): string {
  return `cal-track-${carId}`;
}

export function calendarTaskEventTestId(taskId: number | string): string {
  return `cal-event-task-${taskId}`;
}

/** Click an empty point on a car track to open Quick create. */
export async function clickEmptyCalendarSlot(
  page: Page,
  carId: number | string
): Promise<void> {
  const track = page.getByTestId(calendarTrackTestId(carId));
  await expect(track).toBeVisible({ timeout: 15_000 });
  const box = await track.boundingBox();
  if (!box) throw new Error('clickEmptyCalendarSlot: missing track box');
  await page.mouse.click(box.x + Math.min(80, box.width / 4), box.y + box.height / 2);
  await expect(page.getByTestId('quick-create-menu')).toBeVisible({ timeout: 10_000 });
}

/** From Quick create → Create task → fill title/type/assignee → Create. */
export async function createTaskFromQuickCreate(
  page: Page,
  options: {
    title: string;
    taskTypeLabel?: string;
    carName?: string;
    assigneeEmail?: string;
    startsDate?: string;
    dueDate?: string;
  }
): Promise<void> {
  await page.getByTestId('quick-create-menu').getByRole('menuitem', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { name: 'Create task' })).toBeVisible({
    timeout: 10_000,
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill(options.title);
  if (options.taskTypeLabel) {
    await dialog.getByLabel('Type', { exact: true }).selectOption({ label: options.taskTypeLabel });
  }
  if (options.carName) {
    await dialog.getByLabel('Car').selectOption({ label: options.carName });
  }
  if (options.startsDate) {
    await pickDateSelect(page, 'Starts date', options.startsDate);
  }
  if (options.dueDate) {
    await pickDateSelect(page, 'Due date', options.dueDate);
  }
  if (options.assigneeEmail) {
    const assignee = dialog.getByLabel('Assignee');
    await expect(assignee).toBeVisible({ timeout: 10_000 });
    const option = assignee.locator('option').filter({ hasText: options.assigneeEmail });
    await expect(option).toHaveCount(1, { timeout: 15_000 });
    const value = await option.getAttribute('value');
    expect(value).toBeTruthy();
    await assignee.selectOption(value!);
  }
  const createWait = page.waitForResponse(
    (res) =>
      res.url().includes('/calendar/tasks') &&
      res.request().method() === 'POST' &&
      !res.url().includes('/status'),
    { timeout: 20_000 }
  );
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const createRes = await createWait;
  if (!createRes.ok()) {
    throw new Error(
      `createTaskFromQuickCreate failed (${createRes.status()}): ${await createRes.text()}`
    );
  }
  await expect(page.getByText('Task created')).toBeVisible({ timeout: 15_000 });
}
