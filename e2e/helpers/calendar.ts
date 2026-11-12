// Contribute this line to the enclosing declaration or statement.
import type { Page, APIRequestContext, APIResponse } from '@playwright/test';
// Import named exports from '@playwright/test'.
import { expect } from '@playwright/test';
// Import named exports from './csrf'.
import { apiPost, apiPatch, apiDelete, loginAsAdmin, type ApiSession } from './csrf';
// Import named exports from './dates'.
import { parseSofiaDate, type AllocatedFutureRange } from './dates';

// Export the toSofiaIso function.
export function toSofiaIso(date: string, time = '10:00'): string {
  // Create the parsed constant.
  const parsed = parseSofiaDate(date, time);
  // Evaluate the condition and enter the branch when it is true.
  if (!parsed) {
    // Throw an error to stop the current control flow.
    throw new Error(`toSofiaIso: invalid Sofia date/time ${date} ${time}`);
  }
  // Return the resulting value to the caller.
  return parsed.toISOString();
}

// Export the rangeToIso function.
export function rangeToIso(range: AllocatedFutureRange): { start: string; end: string } {
  // Return the resulting value to the caller.
  return {
    // Provide the start field value.
    start: toSofiaIso(range.pickupDate, range.pickupTime),
    // Provide the end field value.
    end: toSofiaIso(range.returnDate, range.returnTime),
  };
}

// Export the async openCalendarWeek function.
export async function openCalendarWeek(page: Page, date: string): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.goto(`/admin/calendar?view=week&date=${date}`);
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
    // Provide the timeout field value.
    timeout: 15_000,
  });
}

// Export the async openCalendarMonth function.
export async function openCalendarMonth(page: Page, date: string): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.goto(`/admin/calendar?view=month&date=${date}`);
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Fleet calendar' })).toBeVisible({
    // Provide the timeout field value.
    timeout: 15_000,
  });
  // Wait until the asynchronous operation resolves.
  await expect(page.getByTestId('month-fleet-grid')).toBeVisible({ timeout: 15_000 });
}

/** Pick a YYYY-MM-DD value in a DateSelect (aria-label on day buttons). */
export async function pickDateSelect(page: Page, label: string, isoDate: string): Promise<void> {
  // Create the trigger constant.
  const trigger = page.getByRole('button', { name: label, exact: true });
  // Create the picker constant.
  const picker = page.getByRole('dialog', { name: `${label} picker` });

  // Define the async function ensureOpen.
  async function ensureOpen(): Promise<void> {
    // Evaluate the condition and enter the branch when it is true.
    if (await picker.isVisible().catch(() => false)) return;
    // Wait until the asynchronous operation resolves.
    await trigger.click();
    // Wait until the asynchronous operation resolves.
    await picker.waitFor({ state: 'visible', timeout: 10_000 });
  }

  // Wait until the asynchronous operation resolves.
  await ensureOpen();

  // Iterate using the loop initializer, condition, and step.
  for (let i = 0; i < 24; i += 1) {
    // Wait until the asynchronous operation resolves.
    await ensureOpen();
    // Create the day btn constant.
    const dayBtn = picker.getByRole('button', { name: isoDate });
    // Evaluate the condition and enter the branch when it is true.
    if ((await dayBtn.count()) > 0) {
      // Wait until the asynchronous operation resolves.
      await dayBtn.first().evaluate((el) => (el as HTMLButtonElement).click());
      // Wait until the asynchronous operation resolves.
      await expect(picker).toBeHidden({ timeout: 5_000 });
      // Return control to the caller with the following value.
      return;
    }
    // Wait until the asynchronous operation resolves.
    await picker.getByRole('button', { name: 'Next month' }).evaluate((el) =>
      // Continue the surrounding logic with this statement.
      (el as HTMLButtonElement).click()
    );
  }
  // Throw an error to stop the current control flow.
  throw new Error(`pickDateSelect: could not find ${isoDate} for ${label}`);
}

// Define the async function dateSelectHiddenValue.
async function dateSelectHiddenValue(page: Page, label: string): Promise<string | null> {
  // Create the trigger constant.
  const trigger = page.getByRole('button', { name: label, exact: true });
  // Return the resulting value to the caller.
  return trigger.evaluate((el) => {
    // Create the hidden constant.
    const hidden = el.parentElement?.querySelector('input[type="hidden"]');
    // Return the resulting value to the caller.
    return hidden instanceof HTMLInputElement ? hidden.value : null;
  });
}

/** Pick HH:mm in a TimeSelect. */
export async function pickTimeSelect(page: Page, label: string, hhmm: string): Promise<void> {
  // Destructure array values into local variables.
  const [hour, minute] = hhmm.split(':');
  // Create the trigger constant.
  const trigger = page.getByRole('button', { name: label, exact: true });
  // Wait until the asynchronous operation resolves.
  await trigger.click();
  // Create the picker constant.
  const picker = page.getByRole('dialog', { name: `${label} picker` });
  // Wait until the asynchronous operation resolves.
  await picker.waitFor({ state: 'visible', timeout: 10_000 });
  // Hour and minute columns both contain overlapping labels (e.g. "00").
  const columns = picker.locator('ul');
  // Wait until the asynchronous operation resolves.
  await columns.nth(0).getByRole('button', { name: hour, exact: true }).click();
  // Wait until the asynchronous operation resolves.
  await columns.nth(1).getByRole('button', { name: minute, exact: true }).click();
  // Toggle closed — Escape would also dismiss parent Modals (e.g. Block car).
  await trigger.click();
  // Wait until the asynchronous operation resolves.
  await expect(picker).toBeHidden({ timeout: 5_000 });
}

/** Open Block car and fill the form. `getByLabel('Car')` also matches the dialog name. */
export async function fillBlockCarDialog(
  // Provide the page field value.
  page: Page,
  // Provide the options field value.
  options: {
    // Provide the car name field value.
    carName: string;
    // Provide the start date field value.
    startDate: string;
    // Provide the start time field value.
    startTime: string;
    // Provide the end date field value.
    endDate: string;
    // Provide the end time field value.
    endTime: string;
    // Provide the reason field value.
    reason: string;
  }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Block car' }).click();
  // Create the dialog constant.
  const dialog = page.getByRole('dialog', { name: 'Block car' });
  // Wait until the asynchronous operation resolves.
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // Wait until the asynchronous operation resolves.
  await dialog.getByLabel('Car', { exact: true }).selectOption({ label: options.carName });
  // Wait until the asynchronous operation resolves.
  await pickDateSelect(page, 'Start date', options.startDate);
  // Wait until the asynchronous operation resolves.
  await pickTimeSelect(page, 'Start time', options.startTime);
  // Wait until the asynchronous operation resolves.
  await pickDateSelect(page, 'End date', options.endDate);
  // Wait until the asynchronous operation resolves.
  await pickTimeSelect(page, 'End time', options.endTime);
  // Wait until the asynchronous operation resolves.
  await dialog.getByLabel('Reason').fill(options.reason);
  // Wait until the asynchronous operation resolves.
  await dialog.getByRole('button', { name: 'Create block' }).click();
}

// Define the async function adminSession.
async function adminSession(
  // Provide the request field value.
  request: APIRequestContext,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<ApiSession> {
  // Return the resulting value to the caller.
  return session || (await loginAsAdmin(request));
}

// Export the async createManualBlockViaApi function.
export async function createManualBlockViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the body field value.
  body: {
    // Provide the car id field value.
    carId: number | string;
    // Provide the start field value.
    start: string;
    // Provide the end field value.
    end: string;
    // Contribute this line to the enclosing declaration or statement.
    blockType?: string;
    // Contribute this line to the enclosing declaration or statement.
    reason?: string;
    // Contribute this line to the enclosing declaration or statement.
    notes?: string;
    // Contribute this line to the enclosing declaration or statement.
    force?: boolean;
  },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = await adminSession(request, session);
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Supply the literal value used by the enclosing expression.
    '/api/admin/calendar/manual-events',
    {
      // Provide the car id field value.
      carId: Number(body.carId),
      // Provide the start field value.
      start: body.start,
      // Provide the end field value.
      end: body.end,
      // Provide the block type field value.
      blockType: body.blockType ?? 'manual',
      // Provide the reason field value.
      reason: body.reason,
      // Provide the notes field value.
      notes: body.notes,
      // Provide the force field value.
      force: body.force ?? false,
    },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async deleteManualBlockViaApi function.
export async function deleteManualBlockViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the block id field value.
  blockId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = await adminSession(request, session);
  // Create the res constant.
  const res = await apiDelete(request, `/api/admin/calendar/manual-events/${blockId}`, auth);
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async moveCalendarEventViaApi function.
export async function moveCalendarEventViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Provide the body field value.
  body: { start: string; end: string; carId?: number | string; force?: boolean },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = await adminSession(request, session);
  // Create the res constant.
  const res = await apiPatch(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/calendar/events/reservation:${reservationId}/move`,
    {
      // Provide the start field value.
      start: body.start,
      // Provide the end field value.
      end: body.end,
      // Provide the car id field value.
      carId: body.carId != null ? Number(body.carId) : undefined,
      // Provide the force field value.
      force: body.force ?? false,
    },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async resizeCalendarEventViaApi function.
export async function resizeCalendarEventViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Provide the body field value.
  body: { start: string; end: string; carId?: number | string; force?: boolean },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = await adminSession(request, session);
  // Create the res constant.
  const res = await apiPatch(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/calendar/events/reservation:${reservationId}/resize`,
    {
      // Provide the start field value.
      start: body.start,
      // Provide the end field value.
      end: body.end,
      // Provide the car id field value.
      carId: body.carId != null ? Number(body.carId) : undefined,
      // Provide the force field value.
      force: body.force ?? false,
    },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async cancelCalendarReservationViaApi function.
export async function cancelCalendarReservationViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = await adminSession(request, session);
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/calendar/reservations/${reservationId}/cancel`,
    {},
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Define the async function safeJson.
async function safeJson(res: APIResponse): Promise<any> {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return { text: await res.text().catch(() => '') };
  }
}

/** Parse blocked:{id} from create-manual-event response. */
export function blockIdFromCreateResponse(body: any): number | null {
  // Create the event id constant.
  const eventId = body?.data?.event?.id || body?.data?.id;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof eventId === 'string' && eventId.startsWith('blocked:')) {
    // Return the resulting value to the caller.
    return Number(eventId.split(':')[1]);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (typeof eventId === 'number') return eventId;
  // Return the resulting value to the caller.
  return null;
}

// Export the calendarEventTestId function.
export function calendarEventTestId(reservationId: number | string): string {
  // Return the resulting value to the caller.
  return `cal-event-${reservationId}`;
}

/**
 * Pointer-drag a reservation event along the same car track (positive = later).
 * Prefer `days` so the offset tracks week-column width instead of a fixed pixel guess.
 */
export async function dragCalendarEventByOffset(
  // Provide the page field value.
  page: Page,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  options?: { dayOffsetPx?: number; days?: number; expectOk?: boolean }
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Create the event constant.
  const event = page.getByTestId(calendarEventTestId(reservationId));
  // Wait until the asynchronous operation resolves.
  await expect(event).toBeVisible({ timeout: 15_000 });
  // Create the handle constant.
  const handle = event.getByTestId('cal-move-handle');
  // Wait until the asynchronous operation resolves.
  await expect(handle).toBeVisible({ timeout: 15_000 });
  // Create the track constant.
  const track = event.locator('xpath=ancestor::*[@data-track="1"][1]');
  // Create the track box constant.
  const trackBox = await track.boundingBox();
  // Create the handle box constant.
  const handleBox = await handle.boundingBox();
  // Evaluate the condition and enter the branch when it is true.
  if (!trackBox || !handleBox) {
    // Throw an error to stop the current control flow.
    throw new Error('dragCalendarEventByOffset: missing bounding boxes');
  }
  // Create the day px constant.
  const dayPx = Math.max(80, Math.floor(trackBox.width / 7));
  // Create the day offset px constant.
  const dayOffsetPx =
    // Continue the surrounding logic with this statement.
    options?.days != null
      // Contribute this line to the enclosing declaration or statement.
      ? options.days * dayPx
      // Continue the surrounding logic with this statement.
      : (options?.dayOffsetPx ?? Math.max(dayPx, Math.floor(trackBox.width / 3)));
  // Create the expect ok constant.
  const expectOk = options?.expectOk !== false;
  // Create the start x constant.
  const startX = handleBox.x + handleBox.width / 2;
  // Create the start y constant.
  const startY = handleBox.y + handleBox.height / 2;
  // Create the end x constant.
  const endX = Math.min(
    // Contribute this line to the enclosing declaration or statement.
    trackBox.x + trackBox.width - 16,
    // Call Math.max to perform this step.
    Math.max(trackBox.x + 16, startX + dayOffsetPx)
  );
  // Evaluate the condition and enter the branch when it is true.
  if (Math.abs(endX - startX) < dayPx * 0.6) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `dragCalendarEventByOffset: drag collapsed to ${Math.round(endX - startX)}px (need ~${dayPx}px per day). Event is too close to the week edge.`
    );
  }

  // Create the move wait constant.
  const moveWait = page.waitForResponse(
    // Continue the surrounding logic with this statement.
    (res) => res.url().includes('/move') && res.request().method() === 'PATCH',
    // Contribute this line to the enclosing declaration or statement.
    { timeout: 20_000 }
  );

  // Dispatch PointerEvents through the React tree (more reliable than mouse for this calendar).
  await handle.evaluate(
    // Continue the surrounding logic with this statement.
    (el, { x0, y0, x1, y1 }) => {
      // Create the fire constant.
      const fire = (type: string, x: number, y: number, buttons: number) => {
        // Call el.dispatchEvent to perform this step.
        el.dispatchEvent(
          // Continue the surrounding logic with this statement.
          new PointerEvent(type, {
            // Provide the bubbles field value.
            bubbles: true,
            // Provide the cancelable field value.
            cancelable: true,
            // Provide the client x field value.
            clientX: x,
            // Provide the client y field value.
            clientY: y,
            // Provide the pointer id field value.
            pointerId: 1,
            // Provide the pointer type field value.
            pointerType: 'mouse',
            // Contribute this line to the enclosing declaration or statement.
            buttons,
            // Provide the view field value.
            view: window,
          })
        );
      };
      // Call fire to perform this step.
      fire('pointerdown', x0, y0, 1);
      // Create the steps constant.
      const steps = 12;
      // Iterate using the loop initializer, condition, and step.
      for (let i = 1; i <= steps; i += 1) {
        // Create the t constant.
        const t = i / steps;
        // Call fire to perform this step.
        fire('pointermove', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1);
      }
      // Call fire to perform this step.
      fire('pointerup', x1, y1, 0);
    },
    // Contribute this line to the enclosing declaration or statement.
    { x0: startX, y0: startY, x1: endX, y1: startY }
  );

  // Create the move res constant.
  const moveRes = await moveWait;
  // Evaluate the condition and enter the branch when it is true.
  if (expectOk && !moveRes.ok()) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `dragCalendarEventByOffset: move failed (${moveRes.status()}): ${await moveRes.text()}`
    );
  }
  // Return the resulting value to the caller.
  return moveRes;
}

/** Pointer-drag the end resize handle by deltaX pixels (positive lengthens). */
export async function resizeCalendarEventEnd(
  // Provide the page field value.
  page: Page,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Provide the delta x field value.
  deltaX: number
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Create the event constant.
  const event = page.getByTestId(calendarEventTestId(reservationId));
  // Wait until the asynchronous operation resolves.
  await expect(event).toBeVisible({ timeout: 15_000 });
  // Create the handle constant.
  const handle = event.getByTestId('cal-resize-end');
  // Wait until the asynchronous operation resolves.
  await expect(handle).toBeVisible({ timeout: 15_000 });
  // Wait until the asynchronous operation resolves.
  await handle.scrollIntoViewIfNeeded();

  // Create the track constant.
  const track = event.locator('xpath=ancestor::*[@data-track="1"][1]');
  // Create the track box constant.
  const trackBox = await track.boundingBox();
  // Create the box constant.
  const box = await handle.boundingBox();
  // Evaluate the condition and enter the branch when it is true.
  if (!box || !trackBox) {
    // Throw an error to stop the current control flow.
    throw new Error('resizeCalendarEventEnd: missing bounding boxes');
  }

  // Create the start x constant.
  const startX = box.x + box.width / 2;
  // Create the start y constant.
  const startY = box.y + box.height / 2;
  // Create the day px constant.
  const dayPx = Math.max(80, Math.floor(trackBox.width / 7));
  // Create the applied delta constant.
  const appliedDelta = deltaX >= 0 ? Math.max(deltaX, dayPx) : -Math.max(Math.abs(deltaX), dayPx);
  // Create the end x constant.
  const endX = Math.min(
    // Contribute this line to the enclosing declaration or statement.
    trackBox.x + trackBox.width - 8,
    // Call Math.max to perform this step.
    Math.max(trackBox.x + 8, startX + appliedDelta)
  );

  // Create the resize wait constant.
  const resizeWait = page.waitForResponse(
    // Continue the surrounding logic with this statement.
    (res) => res.url().includes('/resize') && res.request().method() === 'PATCH',
    // Contribute this line to the enclosing declaration or statement.
    { timeout: 20_000 }
  );

  // Same PointerEvent path as drag-move: calendar resize listens on window, not mouse.
  await handle.evaluate(
    // Continue the surrounding logic with this statement.
    (el, { x0, y0, x1, y1 }) => {
      // Create the fire constant.
      const fire = (target: EventTarget, type: string, x: number, y: number, buttons: number) => {
        // Call target.dispatchEvent to perform this step.
        target.dispatchEvent(
          // Continue the surrounding logic with this statement.
          new PointerEvent(type, {
            // Provide the bubbles field value.
            bubbles: true,
            // Provide the cancelable field value.
            cancelable: true,
            // Provide the client x field value.
            clientX: x,
            // Provide the client y field value.
            clientY: y,
            // Provide the pointer id field value.
            pointerId: 1,
            // Provide the pointer type field value.
            pointerType: 'mouse',
            // Contribute this line to the enclosing declaration or statement.
            buttons,
            // Provide the view field value.
            view: window,
          })
        );
      };
      // Call fire to perform this step.
      fire(el, 'pointerdown', x0, y0, 1);
      // Create the steps constant.
      const steps = 12;
      // Iterate using the loop initializer, condition, and step.
      for (let i = 1; i <= steps; i += 1) {
        // Create the t constant.
        const t = i / steps;
        // Call fire to perform this step.
        fire(window, 'pointermove', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1);
      }
      // Call fire to perform this step.
      fire(window, 'pointerup', x1, y1, 0);
    },
    // Contribute this line to the enclosing declaration or statement.
    { x0: startX, y0: startY, x1: endX, y1: startY }
  );

  // Create the resize res constant.
  const resizeRes = await resizeWait;
  // Evaluate the condition and enter the branch when it is true.
  if (!resizeRes.ok()) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `resizeCalendarEventEnd: resize failed (${resizeRes.status()}): ${await resizeRes.text()}`
    );
  }
  // Return the resulting value to the caller.
  return resizeRes;
}

// Export the calendarTrackTestId function.
export function calendarTrackTestId(carId: number | string): string {
  // Return the resulting value to the caller.
  return `cal-track-${carId}`;
}

// Export the calendarTaskEventTestId function.
export function calendarTaskEventTestId(taskId: number | string): string {
  // Return the resulting value to the caller.
  return `cal-event-task-${taskId}`;
}

/** Click an empty point on a car track to open Quick create. */
export async function clickEmptyCalendarSlot(
  // Provide the page field value.
  page: Page,
  // Provide the car id field value.
  carId: number | string
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the track constant.
  const track = page.getByTestId(calendarTrackTestId(carId));
  // Wait until the asynchronous operation resolves.
  await expect(track).toBeVisible({ timeout: 15_000 });
  // Create the box constant.
  const box = await track.boundingBox();
  // Evaluate the condition and enter the branch when it is true.
  if (!box) throw new Error('clickEmptyCalendarSlot: missing track box');
  // Wait until the asynchronous operation resolves.
  await page.mouse.click(box.x + Math.min(80, box.width / 4), box.y + box.height / 2);
  // Wait until the asynchronous operation resolves.
  await expect(page.getByTestId('quick-create-menu')).toBeVisible({ timeout: 10_000 });
}

/** From Quick create → Create task → fill title/type/assignee → Create. */
export async function createTaskFromQuickCreate(
  // Provide the page field value.
  page: Page,
  // Provide the options field value.
  options: {
    // Provide the title field value.
    title: string;
    // Contribute this line to the enclosing declaration or statement.
    taskTypeLabel?: string;
    // Contribute this line to the enclosing declaration or statement.
    carName?: string;
    // Contribute this line to the enclosing declaration or statement.
    assigneeEmail?: string;
    // Contribute this line to the enclosing declaration or statement.
    startsDate?: string;
    // Contribute this line to the enclosing declaration or statement.
    dueDate?: string;
  }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.getByTestId('quick-create-menu').getByRole('menuitem', { name: 'Create task' }).click();
  // Create the dialog constant.
  const dialog = page
    // Call .getByRole to perform this step.
    .getByRole('dialog')
    // Call .filter to perform this step.
    .filter({ has: page.getByRole('heading', { name: 'Create task' }) });
  // Wait until the asynchronous operation resolves.
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // Wait until the asynchronous operation resolves.
  await dialog.getByLabel('Title').fill(options.title);
  // Evaluate the condition and enter the branch when it is true.
  if (options.taskTypeLabel) {
    // Wait until the asynchronous operation resolves.
    await dialog.getByLabel('Type', { exact: true }).selectOption({ label: options.taskTypeLabel });
  }
  // Evaluate the condition and enter the branch when it is true.
  if (options.carName) {
    // Wait until the asynchronous operation resolves.
    await dialog.getByLabel('Car', { exact: true }).selectOption({ label: options.carName });
  }
  // Evaluate the condition and enter the branch when it is true.
  if (options.startsDate) {
    // Create the current constant.
    const current = await dateSelectHiddenValue(page, 'Starts date');
    // Evaluate the condition and enter the branch when it is true.
    if (current !== options.startsDate) {
      // Wait until the asynchronous operation resolves.
      await pickDateSelect(page, 'Starts date', options.startsDate);
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (options.dueDate) {
    // Create the current constant.
    const current = await dateSelectHiddenValue(page, 'Due date');
    // Evaluate the condition and enter the branch when it is true.
    if (current !== options.dueDate) {
      // Wait until the asynchronous operation resolves.
      await pickDateSelect(page, 'Due date', options.dueDate);
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (options.assigneeEmail) {
    // Create the assignee constant.
    const assignee = dialog.getByLabel('Assignee');
    // Wait until the asynchronous operation resolves.
    await expect(assignee).toBeVisible({ timeout: 10_000 });
    // Create the option constant.
    const option = assignee.locator('option').filter({ hasText: options.assigneeEmail });
    // Wait until the asynchronous operation resolves.
    await expect(option).toHaveCount(1, { timeout: 15_000 });
    // Create the value constant.
    const value = await option.getAttribute('value');
    // Assert that the value matches the intended expectation.
    expect(value).toBeTruthy();
    // Wait until the asynchronous operation resolves.
    await assignee.selectOption(value!);
  }
  // Create the create wait constant.
  const createWait = page.waitForResponse(
    // Continue the surrounding logic with this statement.
    (res) =>
      // Call res.url to perform this step.
      res.url().includes('/calendar/tasks') &&
      // Call res.request to perform this step.
      res.request().method() === 'POST' &&
      // Continue the surrounding logic with this statement.
      !res.url().includes('/status'),
    // Contribute this line to the enclosing declaration or statement.
    { timeout: 20_000 }
  );
  // Wait until the asynchronous operation resolves.
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  // Create the create res constant.
  const createRes = await createWait;
  // Evaluate the condition and enter the branch when it is true.
  if (!createRes.ok()) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `createTaskFromQuickCreate failed (${createRes.status()}): ${await createRes.text()}`
    );
  }
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Task created')).toBeVisible({ timeout: 15_000 });
}
