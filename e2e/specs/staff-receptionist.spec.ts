import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet, apiPost } from '../helpers/csrf';
import { createCalendarTaskViaApi, loginAsStaff } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'receptionist' });

test.describe('STAFF-003 Receptionist scope', () => {
  test.setTimeout(90_000);

  test('receptionist nav and API scope', async ({ staffPage, staffUser, request }) => {
    await insertTestAdmin();

    await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

    await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Roles' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

    await staffPage.goto('/admin/tasks');
    await expect(staffPage.getByRole('heading', { name: 'Task board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByRole('button', { name: 'Create task' })).toBeVisible();
    await staffPage.getByRole('button', { name: 'Create task' }).click();
    await expect(staffPage.getByRole('heading', { name: 'Create task' })).toBeVisible();
    await expect(staffPage.getByLabel('Assignee', { exact: true })).toHaveCount(0);

    const session = await loginAsStaff(request, staffUser);
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const created = await createCalendarTaskViaApi(
      request,
      { title: `E2E Reception Task ${Date.now()}`, taskType: 'document_check', startsAt, dueAt },
      session
    );
    expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

    const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', session);
    expect(assignable.status()).toBe(403);

    const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
    expect(refund.status()).toBe(403);

    const users = await apiGet(request, '/api/admin/users', session);
    expect(users.status()).toBe(403);
  });
});
