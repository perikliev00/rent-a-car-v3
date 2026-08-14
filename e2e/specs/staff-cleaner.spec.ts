import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet, apiPost } from '../helpers/csrf';
import {
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  loginAsStaff,
  updateTaskStatusViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'cleaner' });

test.describe('STAFF-004 Cleaner scope', () => {
  test.setTimeout(120_000);

  let managerEmail: string | null = null;

  test.afterAll(async () => {
    if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
  });

  test('cleaner nav, own tasks, create denied', async ({ staffPage, staffUser, request }) => {
    await insertTestAdmin();
    const manager = await insertTestStaff({ roleSlug: 'manager' });
    managerEmail = manager.email;

    await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByRole('link', { name: 'Cars' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'My tasks' })).toBeVisible();

    await expect(staffPage.getByRole('link', { name: 'Ops' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);

    const managerSession = await loginAsStaff(request, manager);
    const title = `E2E Clean Task ${Date.now()}`;
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const dueAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const created = await createCalendarTaskViaApi(
      request,
      {
        title,
        taskType: 'cleaning',
        assignedToUserId: staffUser.userId,
        startsAt,
        dueAt,
      },
      managerSession
    );
    expect(created.ok, JSON.stringify(created.body)).toBeTruthy();

    await staffPage.goto('/admin/tasks/cleaner');
    await expect(staffPage.getByRole('heading', { name: 'Cleaner tasks' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByText(title)).toBeVisible({ timeout: 15_000 });

    const cleanerSession = await loginAsStaff(request, staffUser);
    const start = await updateTaskStatusViaApi(
      request,
      created.taskId!,
      'in_progress',
      cleanerSession
    );
    expect(start.ok, JSON.stringify(start.body)).toBeTruthy();

    const createDenied = await createCalendarTaskViaApi(
      request,
      { title: 'nope', taskType: 'cleaning', startsAt, dueAt },
      cleanerSession
    );
    expect(createDenied.status).toBe(403);

    const assignable = await apiGet(request, '/api/admin/calendar/assignable-staff', cleanerSession);
    expect(assignable.status()).toBe(403);

    const ops = await apiGet(request, '/api/admin/reservations/ops-dashboard', cleanerSession);
    expect(ops.status()).toBe(403);

    const refund = await apiPost(
      request,
      '/api/admin/payments/reconcile',
      { dryRun: true },
      cleanerSession
    );
    expect(refund.status()).toBe(403);
  });
});
