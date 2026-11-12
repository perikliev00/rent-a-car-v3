// Contribute this line to the enclosing declaration or statement.
import type { Page, APIRequestContext } from '@playwright/test';
// Import named exports from '@playwright/test'.
import { expect } from '@playwright/test';
// Import named exports from './csrf'.
import { apiPost, type ApiSession, loginAsAdmin } from './csrf';

/** Open ops detail for a reservation and apply a status from the row Actions select. */
export async function applyOpsStatus(
  // Provide the page field value.
  page: Page,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Provide the status field value.
  status: string,
  // Contribute this line to the enclosing declaration or statement.
  options?: { viaApiFallback?: boolean; request?: APIRequestContext }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the id constant.
  const id = String(reservationId);
  // Wait until the asynchronous operation resolves.
  await page.goto(`/admin/reservations?id=${id}`);
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
    // Provide the timeout field value.
    timeout: 15_000,
  });
  // Ensure widgets refresh after prior mutations.
  await page.getByRole('button', { name: 'Refresh' }).click();
  // Wait until the asynchronous operation resolves.
  await expect(page.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();

  // Create the row constant.
  const row = page.locator('tbody tr').filter({
    // Provide the has field value.
    has: page.getByRole('button', { name: id, exact: true }),
  });

  // Create the row visible constant.
  const rowVisible = await row
    // Call .first to perform this step.
    .first()
    // Call .waitFor to perform this step.
    .waitFor({ state: 'visible', timeout: 8_000 })
    // Call .then to perform this step.
    .then(() => true)
    // Call .catch to perform this step.
    .catch(() => false);

  // Evaluate the condition and enter the branch when it is true.
  if (!rowVisible) {
    // Evaluate the condition and enter the branch when it is true.
    if (options?.viaApiFallback !== false && options?.request) {
      // Create the result constant.
      const result = await changeOpsStatusViaApi(options.request, reservationId, status);
      // Evaluate the condition and enter the branch when it is true.
      if (!result.ok) {
        // Throw an error to stop the current control flow.
        throw new Error(
          // Continue the surrounding logic with this statement.
          `applyOpsStatus API fallback failed (${result.status}): ${JSON.stringify(result.body)}`
        );
      }
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Refresh' }).click();
      // Return control to the caller with the following value.
      return;
    }
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `applyOpsStatus: reservation ${id} not visible in any ops widget (seed Sofia-today dates or use viaApiFallback)`
    );
  }

  // Create the target constant.
  const target = row.first();
  // Wait until the asynchronous operation resolves.
  await target.locator('select').selectOption(status);
  // Wait until the asynchronous operation resolves.
  await target.getByRole('button', { name: 'Apply' }).click();
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Status updated')).toBeVisible({ timeout: 15_000 });
}

// Export the async changeOpsStatusViaApi function.
export async function changeOpsStatusViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Provide the status field value.
  status: string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: unknown }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/reservations/${reservationId}/status`,
    // Contribute this line to the enclosing declaration or statement.
    { status, reason: 'admin_ops_dashboard' },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Continue the surrounding logic with this statement.
  let body: unknown = null;
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in body.
    body = await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Store the awaited result in body.
    body = await res.text();
  }
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body };
}

// Export the async refundReservationViaApi function.
export async function refundReservationViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession,
  // Update reason with the right-hand side value.
  reason = 'admin_ops_dashboard_refund'
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: unknown }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/reservations/${reservationId}/refund`,
    // Contribute this line to the enclosing declaration or statement.
    { reason },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Continue the surrounding logic with this statement.
  let body: unknown = null;
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in body.
    body = await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Store the awaited result in body.
    body = await res.text();
  }
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body };
}

// Export the async fillAndSavePickupChecklist function.
export async function fillAndSavePickupChecklist(
  // Provide the page field value.
  page: Page,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  values?: { fuelLevel?: string; mileage?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the id constant.
  const id = String(reservationId);
  // Wait until the asynchronous operation resolves.
  await page.goto(`/admin/reservations?id=${id}`);
  // Wait until the asynchronous operation resolves.
  await expect(
    // Call page.getByRole to perform this step.
    page.getByRole('heading', { name: `Pickup / return checklist · #${id}` })
  // Continue the surrounding logic with this statement.
  ).toBeVisible({ timeout: 15_000 });

  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Fuel level').selectOption(values?.fuelLevel ?? 'full');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Mileage').fill(values?.mileage ?? '12000');
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Save pickup checklist' }).click();
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Pickup checklist saved')).toBeVisible({ timeout: 15_000 });
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Pickup checklist on file')).toBeVisible({ timeout: 15_000 });
}

// Export the async fillAndSaveReturnChecklist function.
export async function fillAndSaveReturnChecklist(
  // Provide the page field value.
  page: Page,
  // Provide the reservation id field value.
  reservationId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  values?: { fuelLevel?: string; mileage?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the id constant.
  const id = String(reservationId);
  // Wait until the asynchronous operation resolves.
  await page.goto(`/admin/reservations?id=${id}`);
  // Wait until the asynchronous operation resolves.
  await expect(
    // Call page.getByRole to perform this step.
    page.getByRole('heading', { name: `Pickup / return checklist · #${id}` })
  // Continue the surrounding logic with this statement.
  ).toBeVisible({ timeout: 15_000 });

  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Fuel level').selectOption(values?.fuelLevel ?? 'half');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Mileage').fill(values?.mileage ?? '12150');
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Save return checklist' }).click();
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Return checklist saved')).toBeVisible({ timeout: 15_000 });
  // Wait until the asynchronous operation resolves.
  await expect(page.getByText('Return checklist on file')).toBeVisible({ timeout: 15_000 });
}
