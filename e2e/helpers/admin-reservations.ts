import type { Page, APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { apiPost, type ApiSession, loginAsAdmin } from './csrf';

/** Open ops detail for a reservation and apply a status from the row Actions select. */
export async function applyOpsStatus(
  page: Page,
  reservationId: number | string,
  status: string,
  options?: { viaApiFallback?: boolean; request?: APIRequestContext }
): Promise<void> {
  const id = String(reservationId);
  await page.goto(`/admin/reservations?id=${id}`);
  await expect(page.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
    timeout: 15_000,
  });
  // Ensure widgets refresh after prior mutations.
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();

  const row = page.locator('tbody tr').filter({
    has: page.getByRole('button', { name: id, exact: true }),
  });

  const rowVisible = await row
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!rowVisible) {
    if (options?.viaApiFallback !== false && options?.request) {
      const result = await changeOpsStatusViaApi(options.request, reservationId, status);
      if (!result.ok) {
        throw new Error(
          `applyOpsStatus API fallback failed (${result.status}): ${JSON.stringify(result.body)}`
        );
      }
      await page.getByRole('button', { name: 'Refresh' }).click();
      return;
    }
    throw new Error(
      `applyOpsStatus: reservation ${id} not visible in any ops widget (seed Sofia-today dates or use viaApiFallback)`
    );
  }

  const target = row.first();
  await target.locator('select').selectOption(status);
  await target.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Status updated')).toBeVisible({ timeout: 15_000 });
}

export async function changeOpsStatusViaApi(
  request: APIRequestContext,
  reservationId: number | string,
  status: string,
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPost(
    request,
    `/api/admin/reservations/${reservationId}/status`,
    { status, reason: 'admin_ops_dashboard' },
    auth
  );
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { ok: res.ok(), status: res.status(), body };
}

export async function refundReservationViaApi(
  request: APIRequestContext,
  reservationId: number | string,
  session?: ApiSession,
  reason = 'admin_ops_dashboard_refund'
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPost(
    request,
    `/api/admin/reservations/${reservationId}/refund`,
    { reason },
    auth
  );
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { ok: res.ok(), status: res.status(), body };
}

export async function fillAndSavePickupChecklist(
  page: Page,
  reservationId: number | string,
  values?: { fuelLevel?: string; mileage?: string }
): Promise<void> {
  const id = String(reservationId);
  await page.goto(`/admin/reservations?id=${id}`);
  await expect(
    page.getByRole('heading', { name: `Pickup / return checklist · #${id}` })
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Fuel level').selectOption(values?.fuelLevel ?? 'full');
  await page.getByLabel('Mileage').fill(values?.mileage ?? '12000');
  await page.getByRole('button', { name: 'Save pickup checklist' }).click();
  await expect(page.getByText('Pickup checklist saved')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Pickup checklist on file')).toBeVisible({ timeout: 15_000 });
}

export async function fillAndSaveReturnChecklist(
  page: Page,
  reservationId: number | string,
  values?: { fuelLevel?: string; mileage?: string }
): Promise<void> {
  const id = String(reservationId);
  await page.goto(`/admin/reservations?id=${id}`);
  await expect(
    page.getByRole('heading', { name: `Pickup / return checklist · #${id}` })
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Fuel level').selectOption(values?.fuelLevel ?? 'half');
  await page.getByLabel('Mileage').fill(values?.mileage ?? '12150');
  await page.getByRole('button', { name: 'Save return checklist' }).click();
  await expect(page.getByText('Return checklist saved')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Return checklist on file')).toBeVisible({ timeout: 15_000 });
}
