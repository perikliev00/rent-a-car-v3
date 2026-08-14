import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import {
  cleanupTestStaff,
  createCalendarTaskViaApi,
  insertTestStaff,
  loginAsStaff,
  updateTaskStatusViaApi,
} from '../helpers/rbac';
import { apiGet, loginAsAdmin } from '../helpers/csrf';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'driver' });

test.describe('STAFF-001 Manager assigns task; driver own-only', () => {
  test.setTimeout(120_000);

  let managerEmail: string | null = null;
  let otherDriverEmail: string | null = null;

  test.afterAll(async () => {
    if (managerEmail) await cleanupTestStaff(managerEmail).catch(() => undefined);
    if (otherDriverEmail) await cleanupTestStaff(otherDriverEmail).catch(() => undefined);
  });

  test('driver sees assigned task only; cannot mutate others', async ({
    staffPage,
    staffUser,
    request,
  }) => {
    await insertTestAdmin();
    const manager = await insertTestStaff({ roleSlug: 'manager' });
    managerEmail = manager.email;
    const otherDriver = await insertTestStaff({ roleSlug: 'driver' });
    otherDriverEmail = otherDriver.email;

    const managerSession = await loginAsStaff(request, manager);
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const dueAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    const ownTitle = `E2E Driver Own ${Date.now()}`;
    const own = await createCalendarTaskViaApi(
      request,
      {
        title: ownTitle,
        taskType: 'pickup',
        assignedToUserId: staffUser.userId,
        startsAt,
        dueAt,
      },
      managerSession
    );
    expect(own.ok, JSON.stringify(own.body)).toBeTruthy();
    expect(own.taskId).toBeTruthy();

    const otherTitle = `E2E Other Driver ${Date.now()}`;
    const other = await createCalendarTaskViaApi(
      request,
      {
        title: otherTitle,
        taskType: 'delivery',
        assignedToUserId: otherDriver.userId,
        startsAt,
        dueAt,
      },
      managerSession
    );
    expect(other.ok, JSON.stringify(other.body)).toBeTruthy();
    expect(other.taskId).toBeTruthy();

    await staffPage.goto('/admin/tasks/driver');
    await expect(staffPage.getByRole('heading', { name: 'Driver tasks' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByText(ownTitle)).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByText(otherTitle)).toHaveCount(0);

    await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
    await expect(staffPage.getByRole('button', { name: 'Create task' })).toHaveCount(0);

    await staffPage.goto('/admin/tasks');
    await expect(staffPage).toHaveURL(/\/admin\/?$/);

    const driverSession = await loginAsStaff(request, staffUser);
    const startOwn = await updateTaskStatusViaApi(
      request,
      own.taskId!,
      'in_progress',
      driverSession
    );
    expect(startOwn.ok, JSON.stringify(startOwn.body)).toBeTruthy();

    const mutateOther = await updateTaskStatusViaApi(
      request,
      other.taskId!,
      'in_progress',
      driverSession
    );
    expect(mutateOther.status).toBe(403);

    const createDenied = await createCalendarTaskViaApi(
      request,
      { title: 'Driver cannot create', taskType: 'pickup', startsAt, dueAt },
      driverSession
    );
    expect(createDenied.status).toBe(403);

    const assignable = await apiGet(
      request,
      '/api/admin/calendar/assignable-staff',
      driverSession
    );
    expect(assignable.status()).toBe(403);
  });
});
