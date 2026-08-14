import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet, apiPost } from '../helpers/csrf';
import { createCalendarTaskViaApi, loginAsStaff } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'accountant' });

test.describe('STAFF-005 Accountant scope', () => {
  test.setTimeout(90_000);

  test('accountant payments/orders; no ops or tasks', async ({ staffPage, staffUser, request }) => {
    await insertTestAdmin();

    await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);

    await staffPage.goto('/admin/payments');
    await expect(staffPage.getByRole('heading', { name: 'Payments' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByRole('button', { name: 'Reconcile' })).toBeVisible();

    const session = await loginAsStaff(request, staffUser);
    const reconcile = await apiPost(
      request,
      '/api/admin/payments/reconcile',
      { dryRun: true },
      session
    );
    expect(reconcile.status()).not.toBe(403);

    const createTask = await createCalendarTaskViaApi(
      request,
      {
        title: 'accountant blocked',
        taskType: 'pickup',
        startsAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      },
      session
    );
    expect(createTask.status).toBe(403);

    const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', session);
    expect(ops.status()).toBe(403);
  });
});
